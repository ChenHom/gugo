#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { setupCliSignalHandler } from '../utils/signalHandler.js';
import { processStocks } from '../utils/batchProcessor.js';
import ora from 'ora';

const argv = yargs(hideBin(process.argv))
  .option('date', {
    alias: 'd',
    type: 'string',
    description: 'Date in YYYY-MM-DD format',
  })
  .option('stocks', {
    alias: 's',
    type: 'string',
    description: 'Comma-separated stock codes (e.g., 2330,2454)',
  })
  .option('no-cache', {
    type: 'boolean',
    description: 'Disable cache usage',
    default: false,
  })
  .help()
  .parseSync();

async function main(): Promise<void> {
  // 設置信號處理
  const signalHandler = setupCliSignalHandler('抓取估值資料');

  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('🚀 開始抓取估值資料...').start();

    const fetcher = new ValuationFetcher();
    await fetcher.initialize();

    // 添加清理函數
    signalHandler.addCleanupFunction(async () => {
      await fetcher.close();
    });

    initSpinner.succeed('初始化完成');

    const stockCodes = argv.stocks ? argv.stocks.split(',').map(s => s.trim()) : undefined;

    if (stockCodes && stockCodes.length > 1) {
      // 多支股票使用批次處理
      console.log(`📊 將抓取 ${stockCodes.length} 支股票的估值資料`);

      const result = await processStocks(stockCodes, async (stockCode: string) => {
        return await fetcher.fetchValuationData({
          date: argv.date,
          stockNos: [stockCode],
          useCache: !argv['no-cache'],
        });
      }, {
        progressPrefix: '抓取估值資料',
        concurrency: 5,
        maxRetries: 2,
        skipOnError: true,
        onError: (stockCode, error) => {
          if (error.message.includes('402 Payment Required')) {
            console.log(`⚠️  ${stockCode} - FinMind API 配額不足，跳過此股票`);
          } else {
            console.log(`❌ ${stockCode} 估值資料抓取失敗: ${error.message}`);
          }
        }
      });

      // 顯示結果摘要
      console.log(`\n📊 估值資料抓取結果:`);
      console.log(`✅ 成功: ${result.successful.length}/${stockCodes.length} 支股票`);
      if (result.failed.length > 0) {
        console.log(`❌ 失敗: ${result.failed.length} 支股票`);
      }

      // 顯示成功的資料範例
      if (result.successful.length > 0) {
        console.log('\n📊 資料範例:');
        result.successful.slice(0, 5).forEach(({ item: stockCode, result: stockResult }) => {
          if (stockResult.success && stockResult.data && stockResult.data.length > 0) {
            const item = stockResult.data[0];
            if (item) {
              console.log(`  ${item.stockNo}: 本益比=${item.per}, 股價淨值比=${item.pbr}, 殖利率=${item.dividendYield}%`);
            }
          }
        });
      }

    } else {
      // 單支股票或全部股票的原有邏輯
      const fetchSpinner = ora('抓取資料中...').start();
      const result = await fetcher.fetchValuationData({
        date: argv.date,
        stockNos: stockCodes,
        useCache: !argv['no-cache'],
      });

      if (result.success && result.data) {
        fetchSpinner.succeed(`✅ 成功抓取 ${result.data.length} 筆估值記錄`);

        if (result.data.length > 0) {
          console.log('\n📊 資料範例:');
          result.data.slice(0, 5).forEach(item => {
            console.log(`  ${item.stockNo}: 本益比=${item.per}, 股價淨值比=${item.pbr}, 殖利率=${item.dividendYield}%`);
          });
        }
      } else {
        fetchSpinner.fail('估值資料抓取失敗');

        if (result.error?.includes('402 Payment Required')) {
          console.error('⚠️  FinMind API 配額不足，請稍後再試或考慮升級方案');
        } else {
          await ErrorHandler.logError(new Error(result.error ?? 'unknown'), 'fetch-valuation');
          console.error('估值資料抓取失敗');
        }
        process.exit(1);
      }
    }

    await fetcher.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-valuation');

    if ((error as Error).message.includes('402 Payment Required')) {
      console.error('⚠️  FinMind API 配額不足，請稍後再試或考慮升級方案');
    } else {
      console.error('❌ 錯誤:', (error as Error).message);
    }
    process.exit(1);
  }
}

main();
