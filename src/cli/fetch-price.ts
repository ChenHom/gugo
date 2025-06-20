#!/usr/bin/env node

import { PriceFetcher } from '../fetchers/priceFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

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
      default: DEFAULT_STOCK_CODES.join(',')
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
    await ErrorHandler.initialize();
    const initSpinner = ora('正在初始化資料庫...').start();
    await dbManager.initialize();
    initSpinner.succeed('資料庫初始化完成');

    const stockIds = argv.stocks!.split(',').map(s => s.trim());
    const fetcher = new PriceFetcher();
    const fetchSpinner = ora(`開始抓取 ${stockIds.length} 支股票的${argv.type}資料...`).start();
    await fetcher.initialize();

    const endDate: string = new Date().toISOString().split('T')[0]!;
    const startDate: string = new Date(Date.now() - argv.days! * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    let priceCount = 0;
    let valuationCount = 0;

    for (const stockId of stockIds) {
      try {
        fetchSpinner.text = `處理股票 ${stockId}...`;

        if (argv.type === 'price' || argv.type === 'both') {
          const priceData = await fetcher.fetchStockPrice(stockId, startDate, endDate);
          priceCount += priceData.length;
        }

        if (argv.type === 'valuation' || argv.type === 'both') {
          const valuationData = await fetcher.fetchValuation(stockId, startDate, endDate);
          valuationCount += valuationData.length;
        }

      } catch (error) {
        await ErrorHandler.logError(error as Error, 'fetch-price');
      }
    }
    fetchSpinner.succeed('資料抓取完成');

    console.log(`\n✅ 資料抓取完成:`);
    if (argv.type === 'price' || argv.type === 'both') {
      console.log(`📈 股價資料: ${priceCount} 筆`);
    }
    if (argv.type === 'valuation' || argv.type === 'both') {
      console.log(`💰 估值資料: ${valuationCount} 筆`);
    }

    fetcher.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-price');
    console.error('❌ 抓取價格資料失敗');
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
