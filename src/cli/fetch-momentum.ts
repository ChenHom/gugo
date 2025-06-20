#!/usr/bin/env node

import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { DEFAULT_STOCK_CODES } from '../constants/stocks.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

interface Args {
  stocks?: string;
  days?: number;
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
      default: 60
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
    const fetcher = new MomentumFetcher();
    const fetchSpinner = ora(`開始抓取 ${stockIds.length} 支股票的動能資料...`).start();
    await fetcher.initialize();

    const momentumData = await fetcher.fetchMomentumData(stockIds, argv.days);
    fetchSpinner.succeed(`成功抓取 ${momentumData.length} 筆動能資料`);

    // 顯示部分樣本資料
    if (momentumData.length > 0) {
      console.log('\n📈 動能資料樣本:');
      momentumData.forEach(data => {
        const rsi = data.rsi ? data.rsi.toFixed(1) : 'N/A';
        const ma20 = data.ma_20 ? data.ma_20.toFixed(2) : 'N/A';
        const change = data.price_change_1m ? data.price_change_1m.toFixed(1) + '%' : 'N/A';
        console.log(`${data.stock_id}: RSI=${rsi}, MA20=${ma20}, 月變化=${change}`);
      });
    }

    fetcher.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-momentum');
    console.error('❌ 抓取動能資料失敗');
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
