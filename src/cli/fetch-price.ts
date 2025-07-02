#!/usr/bin/env node

import { PriceFetcher } from '../fetchers/priceFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { setupCliSignalHandler } from '../utils/signalHandler.js';
import { processItems } from '../utils/batchProcessor.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';

interface Args {
  stocks?: string;
  days?: number;
  type?: 'price' | 'valuation' | 'both';
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('stocks', {
      alias: 's',
      type: 'string',
      description: '股票代號（逗號分隔）',
      default: DEFAULT_STOCK_CODES.slice(0, 10).join(',')
    })
    .option('days', {
      alias: 'd',
      type: 'number',
      description: '取得天數',
      default: 30
    })
    .option('type', {
      alias: 't',
      type: 'string',
      choices: ['price', 'valuation', 'both'],
      description: '資料類型',
      default: 'both'
    })
    .help()
    .argv as Args;

  const dbManager = new DatabaseManager();
  const signalHandler = setupCliSignalHandler('fetch-price');

  // 添加清理函數
  signalHandler.addCleanupFunction(async () => {
    await dbManager.close();
  });

  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('正在初始化資料庫...').start();
    await dbManager.initialize();
    initSpinner.succeed('初始化完成');

    const stockIds = argv.stocks!.split(',').map(s => s.trim());
    const fetcher = new PriceFetcher();
    await fetcher.initialize();

    const endDate: string = new Date().toISOString().split('T')[0]!;
    const startDate: string = new Date(Date.now() - argv.days! * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    // 使用批次處理來抓取價格資料
    const results = await processItems(
      stockIds,
      async (stockId: string) => {
        let priceData: any[] = [];
        let valuationData: any[] = [];

        try {
          if (argv.type === 'price' || argv.type === 'both') {
            priceData = await fetcher.fetchStockPrice(stockId, startDate, endDate);
          }

          if (argv.type === 'valuation' || argv.type === 'both') {
            valuationData = await fetcher.fetchValuation(stockId, startDate, endDate);
          }

          return {
            stockId,
            success: true,
            priceData,
            valuationData
          };
        } catch (error: any) {
          // 針對 402 Payment Required 錯誤提供友善訊息
          if (error.response?.status === 402) {
            console.log(`⚠️  ${stockId}: FinMind API 需要付費方案，跳過此股票`);
          }
          throw error;
        }
      },
      {
        batchSize: 5,
        maxRetries: 2,
        skipOnError: true,
        retryDelay: 1000,
        progressPrefix: `抓取${argv.type}資料`
      }
    );

    // 統計結果
    const successCount = results.successful.length;
    const failedCount = results.failed.length;

    let totalPriceCount = 0;
    let totalValuationCount = 0;

    results.successful.forEach((result: any) => {
      totalPriceCount += result.result.priceData?.length || 0;
      totalValuationCount += result.result.valuationData?.length || 0;
    });

    console.log(`\n✅ 成功抓取 ${successCount} 支股票的資料`);
    if (failedCount > 0) {
      console.log(`⚠️  ${failedCount} 支股票抓取失敗`);
    }

    if (argv.type === 'price' || argv.type === 'both') {
      console.log(`📈 股價資料: ${totalPriceCount} 筆`);
    }
    if (argv.type === 'valuation' || argv.type === 'both') {
      console.log(`💰 估值資料: ${totalValuationCount} 筆`);
    }

    fetcher.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-price');
    console.error('❌ 抓取價格資料失敗:', (error as Error).message);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
