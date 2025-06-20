#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import { ErrorHandler } from '../utils/errorHandler.js';
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

    const fetchSpinner = ora('開始抓取資金流資料...').start();
    const fundFlowResult = await fetcher.fetchFundFlowData({
      stockNos: stockIds,
      useCache: true
    });

    if (fundFlowResult.success && fundFlowResult.data) {
      fetchSpinner.succeed(`總計成功抓取 ${fundFlowResult.data.length} 筆資金流資料`);
    } else {
      fetchSpinner.fail('資金流資料抓取失敗');
      await ErrorHandler.logError(new Error(fundFlowResult.error ?? 'unknown'), 'fetch-fund-flow');
      console.error('資金流資料抓取失敗');
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
