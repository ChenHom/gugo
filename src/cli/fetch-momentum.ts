#!/usr/bin/env node

import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';

async function main() {
  const dbManager = new DatabaseManager();

  try {
    console.log('正在初始化資料庫...');
    await dbManager.initialize();

    console.log('開始抓取動能資料...');
    const fetcher = new MomentumFetcher();
    const momentumData = await fetcher.fetchMomentumData();

    console.log(`✅ 成功抓取 ${momentumData.length} 筆動能資料`);

    // 顯示部分樣本資料
    if (momentumData.length > 0) {
      console.log('\n📈 動能資料樣本:');
      const sample = momentumData.slice(0, 5);
      sample.forEach(data => {
        console.log(`${data.stockNo}: RSI=${data.rsi.toFixed(1)}, MA20=${data.ma20.toFixed(2)}, 月變化=${data.priceChange1M.toFixed(1)}%`);
      });
    }

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
