#!/usr/bin/env node

import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';

async function main(): Promise<void> {
  const dbManager = new DatabaseManager();

  try {
    console.log('🚀 開始全面資料抓取...');

    // 初始化資料庫
    await dbManager.initialize();

    const valuationFetcher = new ValuationFetcher();
    const growthFetcher = new GrowthFetcher();
    const qualityFetcher = new QualityFetcher();
    const fundFlowFetcher = new FundFlowFetcher();
    const momentumFetcher = new MomentumFetcher();

    await Promise.all([
      valuationFetcher.initialize(),
      growthFetcher.initialize(),
    ]);

    let totalRecords = 0;

    // 抓取估值資料
    console.log('📊 抓取估值資料...');
    const valuationResult = await valuationFetcher.fetchValuationData();
    if (valuationResult.success && valuationResult.data) {
      totalRecords += valuationResult.data.length;
      console.log(`✅ 估值資料: ${valuationResult.data.length} 筆`);
    } else {
      console.error('❌ 估值資料抓取失敗:', valuationResult.error);
    }

    // 抓取成長資料 (營收)
    console.log('📈 抓取營收資料...');
    const revenueResult = await growthFetcher.fetchRevenueData();
    if (revenueResult.success && revenueResult.data) {
      totalRecords += revenueResult.data.length;
      console.log(`✅ 營收資料: ${revenueResult.data.length} 筆`);
    } else {
      console.error('❌ 營收資料抓取失敗:', revenueResult.error);
    }

    // 抓取成長資料 (EPS)
    console.log('💰 抓取EPS資料...');
    const epsResult = await growthFetcher.fetchEpsData();
    if (epsResult.success && epsResult.data) {
      totalRecords += epsResult.data.length;
      console.log(`✅ EPS資料: ${epsResult.data.length} 筆`);
    } else {
      console.error('❌ EPS資料抓取失敗:', epsResult.error);
    }

    // 抓取品質資料
    console.log('🔍 抓取品質資料...');
    try {
      const qualityData = await qualityFetcher.fetchQualityData();
      totalRecords += qualityData.length;
      console.log(`✅ 品質資料: ${qualityData.length} 筆`);
    } catch (error) {
      console.error('❌ 品質資料抓取失敗:', error);
    }

    // 抓取資金流資料
    console.log('💸 抓取資金流資料...');
    try {
      const fundFlowData = await fundFlowFetcher.fetchFundFlowData();
      totalRecords += fundFlowData.length;
      console.log(`✅ 資金流資料: ${fundFlowData.length} 筆`);
    } catch (error) {
      console.error('❌ 資金流資料抓取失敗:', error);
    }

    // 抓取動能資料
    console.log('🚀 抓取動能資料...');
    try {
      const momentumData = await momentumFetcher.fetchMomentumData();
      totalRecords += momentumData.length;
      console.log(`✅ 動能資料: ${momentumData.length} 筆`);
    } catch (error) {
      console.error('❌ 動能資料抓取失敗:', error);
    }

    console.log(`\n🎉 資料抓取完成！總計 ${totalRecords} 筆記錄`);
    console.log('📝 下一步：');
    console.log('  • 執行 `npm run rank` 查看排名');
    console.log('  • 執行 `npm run explain <股票代號>` 進行詳細分析');

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-all');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
