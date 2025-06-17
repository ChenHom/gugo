#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';

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
    await dbManager.initialize();

    console.log('開始抓取資金流資料...');
    const fetcher = new FundFlowFetcher();

    const stockIds = argv.stocks ? argv.stocks.split(',').map(s => s.trim()) : ['2330', '2317', '2454'];
    const startDate = argv['start-date'] || '2024-01-01';
    const endDate = argv['end-date'] || new Date().toISOString().split('T')[0];

    let totalRecords = 0;

    for (const stockId of stockIds) {
      console.log(`💰 處理股票: ${stockId}`);
      const fundFlowData = await fetcher.fetchFundFlowData(stockId, startDate, endDate);
      totalRecords += fundFlowData.length;

      console.log(`✅ ${stockId} 成功抓取 ${fundFlowData.length} 筆資金流資料`);

      // 避免 API 限制
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`✅ 總計成功抓取 ${totalRecords} 筆資金流資料`);

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
