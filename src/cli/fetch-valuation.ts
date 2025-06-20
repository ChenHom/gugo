#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
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
    const initSpinner = ora('🚀 開始抓取估值資料...').start();

    const fetcher = new ValuationFetcher();
    await fetcher.initialize();
    initSpinner.succeed('初始化完成');

    const options = {
      date: argv.date,
      stockNos: argv.stocks ? argv.stocks.split(',').map(s => s.trim()) : undefined,
      useCache: !argv['no-cache'],
    };

    const fetchSpinner = ora('抓取估值資料中...').start();
    const result = await fetcher.fetchValuationData(options);

    if (result.success && result.data) {
      fetchSpinner.succeed(`成功抓取 ${result.data.length} 筆估值記錄`);

      if (result.data.length > 0) {
        console.log('\n📊 資料範例:');
        result.data.slice(0, 5).forEach(item => {
          console.log(`  ${item.stockNo}: 本益比=${item.per}, 股價淨值比=${item.pbr}, 殖利率=${item.dividendYield}%`);
        });
      }
    } else {
      fetchSpinner.fail('估值資料抓取失敗');
      await ErrorHandler.logError(new Error(result.error || 'Unknown error'), 'fetch-valuation');
      console.log('估值資料抓取失敗，詳情請查看日誌');
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
