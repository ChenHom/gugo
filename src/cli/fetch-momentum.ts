#!/usr/bin/env node

import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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
      default: '2330,2317,2454,2308,2603'
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
    console.log('正在初始化資料庫...');
    await dbManager.initialize();

    const stockIds = argv.stocks!.split(',').map(s => s.trim());
    console.log(`開始抓取 ${stockIds.length} 支股票的動能資料...`);

    const fetcher = new MomentumFetcher();
    await fetcher.initialize();

    const momentumData = await fetcher.fetchMomentumData(stockIds, argv.days);

    console.log(`✅ 成功抓取 ${momentumData.length} 筆動能資料`);

    // 顯示部分樣本資料
    if (momentumData.length > 0) {
      console.log('\n📈 動能資料樣本:');
      momentumData.forEach(data => {
        const rsi = data.rsi ? data.rsi.toFixed(1) : 'N/A';
        const sma20 = data.sma_20 ? data.sma_20.toFixed(2) : 'N/A';
        const change = data.price_change_1m ? data.price_change_1m.toFixed(1) + '%' : 'N/A';
        console.log(`${data.stock_id}: RSI=${rsi}, SMA20=${sma20}, 月變化=${change}`);
      });
    }

    fetcher.close();

  } catch (error) {
    console.error('❌ 抓取動能資料失敗:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
