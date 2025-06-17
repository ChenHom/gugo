#!/usr/bin/env node

import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';

async function main() {
  const dbManager = new DatabaseManager();

  try {
    console.log('正在初始化資料庫...');
    await dbManager.initialize();

    console.log('開始抓取資金流資料...');
    const fetcher = new FundFlowFetcher();
    const fundFlowData = await fetcher.fetchFundFlowData();

    console.log(`✅ 成功抓取 ${fundFlowData.length} 筆資金流資料`);

    // 顯示部分樣本資料
    if (fundFlowData.length > 0) {
      console.log('\n💰 資金流資料樣本:');
      const sample = fundFlowData.slice(0, 5);
      sample.forEach(data => {
        console.log(`${data.stockNo}: 外資=${data.foreignNet}, 投信=${data.invTrustNet}, 持股比=${data.holdingRatio}%`);
      });
    }

  } catch (error) {
    console.error('❌ 抓取資金流資料失敗:', error);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
