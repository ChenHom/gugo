#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { ErrorHandler } from '../utils/errorHandler.js';

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
    console.log('🚀 Starting growth data fetch...');

    const fetcher = new GrowthFetcher();
    await fetcher.initialize();

    const options = {
      stockNos: argv.stocks ? argv.stocks.split(',').map((s: string) => s.trim()) : undefined,
      useCache: !argv['no-cache'],
    };

    let totalRecords = 0;

    if (argv.type === 'revenue' || argv.type === 'both') {
      console.log('📈 抓取營收資料...');
      const revenueResult = await fetcher.fetchRevenueData(options);

      if (revenueResult.success && revenueResult.data) {
        totalRecords += revenueResult.data.length;
        console.log(`✅ 成功抓取 ${revenueResult.data.length} 筆營收記錄`);
      } else {
        console.error('❌ 營收資料抓取失敗:', revenueResult.error);
      }
    }

    if (argv.type === 'eps' || argv.type === 'both') {
      console.log('💰 抓取EPS資料...');
      const epsResult = await fetcher.fetchEpsData(options);

      if (epsResult.success && epsResult.data) {
        totalRecords += epsResult.data.length;
        console.log(`✅ 成功抓取 ${epsResult.data.length} 筆EPS記錄`);
      } else {
        console.error('❌ EPS資料抓取失敗:', epsResult.error);
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
