#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { ErrorHandler } from '../utils/errorHandler.js';

const argv = yargs(hideBin(process.argv))
  .option('date', {
    alias: 'd',
    type: 'string',
    description: 'Date in YYYY-MM-DD format',
  })
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
  .help()
  .parseSync();

async function main(): Promise<void> {
  try {
    await ErrorHandler.initialize();
    console.log('🚀 開始抓取估值資料...');

    const fetcher = new ValuationFetcher();
    await fetcher.initialize();

    const options = {
      date: argv.date,
      stockNos: argv.stocks ? argv.stocks.split(',').map(s => s.trim()) : undefined,
      useCache: !argv['no-cache'],
    };

    const result = await fetcher.fetchValuationData(options);

    if (result.success && result.data) {
      console.log(`✅ 成功抓取 ${result.data.length} 筆估值記錄`);

      if (result.data.length > 0) {
        console.log('\n📊 資料範例:');
        result.data.slice(0, 5).forEach(item => {
          console.log(`  ${item.stockNo}: 本益比=${item.per}, 股價淨值比=${item.pbr}, 殖利率=${item.dividendYield}%`);
        });
      }
    } else {
      console.error('❌ 估值資料抓取失敗:', result.error);
      process.exit(1);
    }

    await fetcher.close();
    console.log('✅ 估值資料抓取完成');

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-valuation');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  }
}

main();
