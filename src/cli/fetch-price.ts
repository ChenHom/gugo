#!/usr/bin/env node

import { PriceFetcher } from '../fetchers/priceFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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
      default: '2330,2317,2454,2308,2603'
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

  try {
    console.log('正在初始化資料庫...');
    await dbManager.initialize();

    const stockIds = argv.stocks!.split(',').map(s => s.trim());
    console.log(`開始抓取 ${stockIds.length} 支股票的${argv.type}資料...`);

    const fetcher = new PriceFetcher();
    await fetcher.initialize();

    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - argv.days! * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let priceCount = 0;
    let valuationCount = 0;

    for (const stockId of stockIds) {
      try {
        console.log(`處理股票 ${stockId}...`);

        if (argv.type === 'price' || argv.type === 'both') {
          const priceData = await fetcher.fetchStockPrice(stockId, startDate, endDate || undefined);
          priceCount += priceData.length;
          console.log(`✅ ${stockId} 股價資料: ${priceData.length} 筆`);
        }

        if (argv.type === 'valuation' || argv.type === 'both') {
          const valuationData = await fetcher.fetchValuation(stockId, startDate, endDate || undefined);
          valuationCount += valuationData.length;
          console.log(`✅ ${stockId} 估值資料: ${valuationData.length} 筆`);
        }

      } catch (error) {
        console.error(`❌ ${stockId} 資料抓取失敗:`, error);
      }
    }

    console.log(`\n✅ 資料抓取完成:`);
    if (argv.type === 'price' || argv.type === 'both') {
      console.log(`📈 股價資料: ${priceCount} 筆`);
    }
    if (argv.type === 'valuation' || argv.type === 'both') {
      console.log(`💰 估值資料: ${valuationCount} 筆`);
    }

    fetcher.close();

  } catch (error) {
    console.error('❌ 抓取價格資料失敗:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
