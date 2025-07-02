#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { setupCliSignalHandler } from '../utils/signalHandler.js';
import { processItems } from '../utils/batchProcessor.js';
import ora from 'ora';

const argv = yargs(hideBin(process.argv))
  .option('stocks', {
    alias: 's',
    type: 'string',
    description: 'Comma-separated stock codes (e.g., 2330,2454)',
  })
  .option('start-date', {
    type: 'string',
    description: 'Start date (YYYY-MM-DD)',
    default: '2024-01-01',
  })
  .option('end-date', {
    type: 'string',
    description: 'End date (YYYY-MM-DD)',
    default: new Date().toISOString().split('T')[0],
  })
  .help()
  .parseSync();

async function main() {
  const dbManager = new DatabaseManager();
  const signalHandler = setupCliSignalHandler('fetch-fund-flow');

  // 添加清理函數
  signalHandler.addCleanupFunction(async () => {
    await dbManager.close();
  });

  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('正在初始化資料庫...').start();
    await dbManager.initialize();
    const fetcher = new FundFlowFetcher();
    await fetcher.initialize();
    initSpinner.succeed('初始化完成');

    const stockIds = argv.stocks
      ? argv.stocks.split(',').map(s => s.trim())
      : DEFAULT_STOCK_CODES;

    // 使用批次處理來抓取資金流資料
    const results = await processItems(
      stockIds,
      async (stockId: string) => {
        try {
          const fundFlowResult = await fetcher.fetchFundFlowData({
            stockNos: [stockId],
            useCache: true
          });

          if (fundFlowResult.success && fundFlowResult.data) {
            return { stockId, success: true, data: fundFlowResult.data };
          } else {
            throw new Error(fundFlowResult.error ?? 'unknown error');
          }
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
        progressPrefix: '抓取資金流資料'
      }
    );

    // 統計結果
    const successCount = results.successful.length;
    const failedCount = results.failed.length;
    const totalDataCount = results.successful.reduce((sum, result) =>
      sum + (result.result.data?.length || 0), 0);

    console.log(`\n✅ 成功抓取 ${successCount} 支股票的資金流資料，總計 ${totalDataCount} 筆記錄`);
    if (failedCount > 0) {
      console.log(`⚠️  ${failedCount} 支股票抓取失敗`);
    }

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-fund-flow');
    console.error('❌ 抓取資金流資料失敗:', (error as Error).message);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
