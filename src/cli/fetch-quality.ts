#!/usr/bin/env node

import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { setupCliSignalHandler } from '../utils/signalHandler.js';
import { processItems } from '../utils/batchProcessor.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import ora from 'ora';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('stocks', {
    alias: 's',
    type: 'string',
    description: '股票代號（逗號分隔）',
    default: DEFAULT_STOCK_CODES.join(',')
  })
  .help()
  .parseSync();

async function main() {
  const dbManager = new DatabaseManager();
  const signalHandler = setupCliSignalHandler('fetch-quality');

  // 添加清理函數
  signalHandler.addCleanupFunction(async () => {
    await dbManager.close();
  });

  try {
    await ErrorHandler.initialize();

    const initSpinner = ora('正在初始化資料庫...').start();
    await dbManager.initialize();
    initSpinner.succeed('初始化完成');

    const stockIds = argv.stocks.split(',').map(s => s.trim());
    const fetcher = new QualityFetcher();

    // 使用批次處理來抓取品質資料
    const results = await processItems(
      stockIds,
      async (stockId: string) => {
        try {
          const data = await fetcher.fetchQualityData();
          return { stockId, success: true, data };
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
        progressPrefix: '抓取品質資料'
      }
    );

    // 統計結果
    const successCount = results.successful.length;
    const failedCount = results.failed.length;

    console.log(`\n✅ 成功抓取 ${successCount} 支股票的品質資料`);
    if (failedCount > 0) {
      console.log(`⚠️  ${failedCount} 支股票抓取失敗`);
    }

    // 顯示部分樣本資料
    if (results.successful.length > 0) {
      console.log('\n📊 品質資料樣本:');
      const sampleResults = results.successful.slice(0, 5);
      sampleResults.forEach((result: any) => {
        if (result.result.data && result.result.data.length > 0) {
          const data = result.result.data[0];
          console.log(`${result.item}: ROE=${data.roe?.toFixed(2) || 'N/A'}%, 毛利率=${data.gross_margin?.toFixed(2) || 'N/A'}%`);
        }
      });
    }

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-quality');
    console.error('❌ 抓取品質資料失敗:', (error as Error).message);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
