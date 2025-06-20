#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';

const argv = yargs(hideBin(process.argv))
  .option('stocks', {
    alias: 's',
    type: 'string',
    description: 'Comma-separated stock codes (e.g., 2330,2454)',
  })
  .option('no-cache', {
    type: 'boolean',
    description: 'Disable cache usage',
    default: false,
  })
  .option('type', {
    alias: 't',
    type: 'string',
    choices: ['revenue', 'eps', 'both'],
    default: 'both',
    description: 'Type of growth data to fetch',
  })
  .help()
  .parseSync();

async function main(): Promise<void> {
  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('🚀 Starting growth data fetch...').start();

    const fetcher = new GrowthFetcher();
    await fetcher.initialize();
    initSpinner.succeed('Initialization complete');

    const stockList = argv.stocks
      ? argv.stocks.split(',').map((s: string) => s.trim())
      : DEFAULT_STOCK_CODES;
    const options = {
      stockNos: stockList,
      useCache: !argv['no-cache'],
    };

    let totalRecords = 0;

    if (argv.type === 'revenue' || argv.type === 'both') {
      const revenueSpinner = ora('📈 抓取營收資料...').start();
      const revenueResult = await fetcher.fetchRevenueData(options);

      if (revenueResult.success && revenueResult.data) {
        totalRecords += revenueResult.data.length;
        revenueSpinner.succeed(`成功抓取 ${revenueResult.data.length} 筆營收記錄`);
      } else {
        revenueSpinner.fail('營收資料抓取失敗');
        await ErrorHandler.logError(new Error(revenueResult.error ?? 'unknown'), 'fetch-growth:revenue');
        console.error('營收資料抓取失敗');
      }
    }

    if (argv.type === 'eps' || argv.type === 'both') {
      const epsSpinner = ora('💰 抓取EPS資料...').start();
      const epsResult = await fetcher.fetchEpsData(options);

      if (epsResult.success && epsResult.data) {
        totalRecords += epsResult.data.length;
        epsSpinner.succeed(`成功抓取 ${epsResult.data.length} 筆EPS記錄`);
      } else {
        epsSpinner.fail('EPS資料抓取失敗');
        await ErrorHandler.logError(new Error(epsResult.error ?? 'unknown'), 'fetch-growth:eps');
        console.error('EPS資料抓取失敗');
      }
    }

    // Show sample data
    if (totalRecords > 0) {
      console.log('\n📊 成長資料範例:');
      const sampleData = await fetcher.getStoredGrowthData(
        options.stockNos?.[0],
        undefined
      );
      sampleData.slice(0, 3).forEach(item => {
        console.log(`  ${item.stockNo} (${item.month}): 營收=${item.revenue}, 年增率=${item.yoy}%, EPS=${item.eps}`);
      });
    }

    await fetcher.close();
    console.log(`✅ 成長資料抓取完成 (總計 ${totalRecords} 筆記錄)`);

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-growth');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  }
}

main();
