#!/usr/bin/env node

import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';

async function main() {
  const dbManager = new DatabaseManager();

  try {
    console.log('正在初始化資料庫...');
    await dbManager.initialize();

    console.log('開始抓取品質資料...');
    const fetcher = new QualityFetcher();
    const qualityData = await fetcher.fetchQualityData();

    console.log(`✅ 成功抓取 ${qualityData.length} 筆品質資料`);

    // 顯示部分樣本資料
    if (qualityData.length > 0) {
      console.log('\n📊 品質資料樣本:');
      const sample = qualityData.slice(0, 5);
      sample.forEach(data => {
        console.log(`${data.symbol} (${data.name}): ROE=${data.returnOnEquity.toFixed(2)}%, 負債比=${data.debtToEquity.toFixed(2)}`);
      });
    }

  } catch (error) {
    console.error('❌ 抓取品質資料失敗:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
