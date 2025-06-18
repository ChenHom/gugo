#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';

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
    console.log('正在初始化資料庫...');
    await dbManager.initialize();    console.log('開始抓取資金流資料...');
    const fetcher = new FundFlowFetcher();
    await fetcher.initialize();

    const stockIds = argv.stocks
      ? argv.stocks.split(',').map(s => s.trim())
      : DEFAULT_STOCK_CODES;

    const fundFlowResult = await fetcher.fetchFundFlowData({
      stockNos: stockIds,
      useCache: true
    });

    if (fundFlowResult.success && fundFlowResult.data) {
      console.log(`✅ 總計成功抓取 ${fundFlowResult.data.length} 筆資金流資料`);
    } else {
      console.error(`❌ 資金流資料抓取失敗: ${fundFlowResult.error}`);
    }

  } catch (error) {
    console.error('❌ 抓取資金流資料失敗:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
