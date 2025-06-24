#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { StockListService } from '../services/stockListService.js';
import { calcScoreMultiDb } from '../services/calcScoreMultiDb.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';
import fs from 'fs';

const argv = yargs(hideBin(process.argv))
  .option('market', {
    alias: 'm',
    type: 'string',
    description: '篩選市場（上市、上櫃、興櫃）',
  })
  .option('industry', {
    alias: 'i',
    type: 'string',
    description: '篩選產業',
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: '限制顯示數量',
    default: 30,
  })
  .option('min-score', {
    alias: 's',
    type: 'number',
    description: '最低分數篩選',
    default: 0,
  })
  .option('show-scores', {
    type: 'boolean',
    description: '顯示分數（需要計算時間較長）',
    default: false,
  })
  .option('export', {
    alias: 'e',
    type: 'string',
    description: '匯出格式（csv, json）',
  })
  .help()
  .parseSync();

async function main(): Promise<void> {
  try {
    await ErrorHandler.initialize();

    const stockListService = new StockListService();
    await stockListService.initialize();

    // 取得股票清單
    const stocks = stockListService.getStocks({
      ...(argv.market && { market: argv.market }),
      ...(argv.industry && { industry: argv.industry }),
      limit: argv.limit * 2, // 取得更多股票，以便計算分數後篩選
    });

    if (stocks.length === 0) {
      console.log('📭 沒有找到符合條件的股票');
      stockListService.close();
      return;
    }

    console.log(`📊 找到 ${stocks.length} 支股票`);

    let stocksWithScores = stocks.map(stock => ({
      ...stock,
      totalScore: undefined as number | undefined,
      subScores: undefined as any,
    }));

    // 如果需要顯示分數，計算分數
    if (argv.showScores) {
      const spinner = ora('🔢 計算股票分數...').start();

      try {
        for (let i = 0; i < stocks.length; i++) {
          const stock = stocks[i]!;
          try {
            const scoreResult = await calcScoreMultiDb(stock.stockNo);
            stocksWithScores[i] = {
              ...stock,
              totalScore: scoreResult.total,
              subScores: {
                valuation: scoreResult.valuation,
                growth: scoreResult.growth,
                quality: scoreResult.quality,
                chips: scoreResult.chips,
                momentum: scoreResult.momentum,
              },
            };
          } catch (error) {
            // 分數計算失敗，保持原有資料
            console.warn(`⚠️  ${stock.stockNo} 分數計算失敗`);
          }

          if (i % 10 === 0) {
            spinner.text = `🔢 計算股票分數... (${i + 1}/${stocks.length})`;
          }
        }

        spinner.succeed('✅ 分數計算完成');

        // 篩選最低分數
        stocksWithScores = stocksWithScores
          .filter(stock => !stock.totalScore || stock.totalScore >= argv.minScore)
          .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
          .slice(0, argv.limit);

      } catch (error) {
        spinner.fail('❌ 分數計算失敗');
        await ErrorHandler.logError(error as Error, 'list-stocks:scoring');
      }
    } else {
      stocksWithScores = stocksWithScores.slice(0, argv.limit);
    }

    // 顯示結果
    displayResults(stocksWithScores, argv.showScores);

    // 匯出資料
    if (argv.export) {
      exportData(stocksWithScores, argv.export, argv.showScores);
    }

    stockListService.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'list-stocks');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  }
}

function displayResults(stocks: any[], showScores: boolean): void {
  if (showScores) {
    console.log('\n📈 股票清單與分數：');
    console.log('');
    console.log('代碼    公司名稱           市場  總分  估值  成長  品質  籌碼  動能');
    console.log('----  ----------------  ----  ----  ----  ----  ----  ----  ----');

    for (const stock of stocks) {
      const score = stock.totalScore;
      const sub = stock.subScores;

      console.log(
        `${stock.stockNo.padEnd(6)} ` +
        `${(stock.name || '').substring(0, 14).padEnd(16)} ` +
        `${(stock.market || '').padEnd(4)} ` +
        `${score ? score.toFixed(0).padStart(4) : '  - '} ` +
        `${sub?.valuation ? sub.valuation.toFixed(0).padStart(4) : '  - '} ` +
        `${sub?.growth ? sub.growth.toFixed(0).padStart(4) : '  - '} ` +
        `${sub?.quality ? sub.quality.toFixed(0).padStart(4) : '  - '} ` +
        `${sub?.chips ? sub.chips.toFixed(0).padStart(4) : '  - '} ` +
        `${sub?.momentum ? sub.momentum.toFixed(0).padStart(4) : '  - '}`
      );
    }
  } else {
    console.log('\n📋 股票清單：');
    console.log('');
    console.log('代碼    公司名稱              市場  產業');
    console.log('----  -------------------  ----  ----------');

    for (const stock of stocks) {
      console.log(
        `${stock.stockNo.padEnd(6)} ` +
        `${(stock.name || '').substring(0, 17).padEnd(19)} ` +
        `${(stock.market || '').padEnd(4)} ` +
        `${(stock.industry || '').substring(0, 10)}`
      );
    }
  }

  console.log(`\n📊 共顯示 ${stocks.length} 支股票`);
}

function exportData(stocks: any[], format: string, showScores: boolean): void {
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `stock-list-${timestamp}.${format}`;

  try {
    if (format === 'csv') {
      exportToCsv(stocks, filename, showScores);
    } else if (format === 'json') {
      exportToJson(stocks, filename);
    } else {
      console.warn(`⚠️  不支援的匯出格式: ${format}`);
      return;
    }

    console.log(`💾 資料已匯出至: ${filename}`);
  } catch (error) {
    console.error('❌ 匯出失敗:', (error as Error).message);
  }
}

function exportToCsv(stocks: any[], filename: string, showScores: boolean): void {

  let headers: string[];
  if (showScores) {
    headers = ['代碼', '公司名稱', '市場', '產業', '總分', '估值', '成長', '品質', '籌碼', '動能'];
  } else {
    headers = ['代碼', '公司名稱', '市場', '產業'];
  }

  const csvContent = [
    headers.join(','),
    ...stocks.map(stock => {
      const baseData = [
        stock.stockNo,
        `"${stock.name || ''}"`,
        stock.market || '',
        `"${stock.industry || ''}"`,
      ];

      if (showScores) {
        baseData.push(
          stock.totalScore?.toFixed(2) || '',
          stock.subScores?.valuation?.toFixed(2) || '',
          stock.subScores?.growth?.toFixed(2) || '',
          stock.subScores?.quality?.toFixed(2) || '',
          stock.subScores?.chips?.toFixed(2) || '',
          stock.subScores?.momentum?.toFixed(2) || ''
        );
      }

      return baseData.join(',');
    })
  ].join('\n');

  fs.writeFileSync(filename, csvContent, 'utf8');
}

function exportToJson(stocks: any[], filename: string): void {
  fs.writeFileSync(filename, JSON.stringify(stocks, null, 2), 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as run };
