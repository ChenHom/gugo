#!/usr/bin/env node

import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
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
      default: 60
    })
    .help()
    .argv as Args;

  const dbManager = new DatabaseManager();
  const signalHandler = setupCliSignalHandler('fetch-momentum');

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
    const fetcher = new MomentumFetcher();
    await fetcher.initialize();

    // 使用批次處理來抓取動能資料
    const results = await processItems(
      stockIds,
      async (stockId: string) => {
        try {
          const momentumData = await fetcher.fetchMomentumData([stockId], argv.days);
          return { stockId, success: true, data: momentumData };
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
        progressPrefix: '抓取動能資料'
      }
    );

    // 統計結果
    const successCount = results.successful.length;
    const failedCount = results.failed.length;
    const totalDataCount = results.successful.reduce((sum, result) =>
      sum + (result.result.data?.length || 0), 0);

    console.log(`\n✅ 成功抓取 ${successCount} 支股票的動能資料，總計 ${totalDataCount} 筆記錄`);
    if (failedCount > 0) {
      console.log(`⚠️  ${failedCount} 支股票抓取失敗`);
    }

    // 顯示部分樣本資料
    if (results.successful.length > 0) {
      console.log('\n📊 動能資料樣本:');
      const sampleResults = results.successful.slice(0, 5);
      sampleResults.forEach((result: any) => {
        if (result.result.data && result.result.data.length > 0) {
          const data = result.result.data[0];
          const rsi = data.rsi ? data.rsi.toFixed(1) : 'N/A';
          const ma20 = data.ma_20 ? data.ma_20.toFixed(2) : 'N/A';
          const change = data.price_change_1m ? data.price_change_1m.toFixed(1) + '%' : 'N/A';
          console.log(`${result.item}: RSI=${rsi}, MA20=${ma20}, 月變化=${change}`);
        }
      });
    }

    fetcher.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-momentum');
    console.error('❌ 抓取動能資料失敗:', (error as Error).message);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
