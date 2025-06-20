#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import { ErrorHandler } from '../utils/errorHandler.js';

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

  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('正在初始化資料庫...').start();
    await dbManager.initialize();
    initSpinner.succeed('資料庫初始化完成');

    const fetcher = new FundFlowFetcher();
    const fetchSpinner = ora('開始抓取資金流資料...').start();
    await fetcher.initialize();

    const stockIds = argv.stocks
      ? argv.stocks.split(',').map(s => s.trim())
      : DEFAULT_STOCK_CODES;

    const fundFlowResult = await fetcher.fetchFundFlowData({
      stockNos: stockIds,
      useCache: true
    });

    if (fundFlowResult.success && fundFlowResult.data) {
      fetchSpinner.succeed(`總計成功抓取 ${fundFlowResult.data.length} 筆資金流資料`);
    } else {
      fetchSpinner.fail('資金流資料抓取失敗');
      await ErrorHandler.logError(new Error(fundFlowResult.error || 'Unknown error'), 'fetch-fund-flow');
      console.log('資金流資料抓取失敗，詳情請查看日誌');
    }

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-fund-flow');
    console.error('❌ 抓取資金流資料失敗');
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
