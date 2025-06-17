#!/usr/bin/env node

import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { PriceFetcher } from '../fetchers/priceFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';

// 測試用股票代碼
const TEST_STOCKS = ['2330', '2317', '2891', '2454', '2412'];

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
    const priceFetcher = new PriceFetcher();

    // 初始化所有 fetcher
    await Promise.all([
      valuationFetcher.initialize(),
      growthFetcher.initialize(),
      qualityFetcher.initialize(),
      fundFlowFetcher.initialize(),
      priceFetcher.initialize(),
    ]);

    let totalRecords = 0;
    const startDate = '2022-01-01';
    const endDate = '2024-12-31';

    // 對每檔股票進行資料抓取
    for (const stockId of TEST_STOCKS) {
      console.log(`\n📊 處理股票: ${stockId}`);

      // 抓取股價資料
      try {
        const priceData = await priceFetcher.fetchStockPrice(stockId, startDate, endDate);
        totalRecords += priceData.length;
        console.log(`✅ 股價資料: ${priceData.length} 筆`);
      } catch (error) {
        console.error(`❌ 股價資料抓取失敗 (${stockId}):`, error);
      }

      // 抓取估值資料 (PER/PBR)
      try {
        const valuationData = await priceFetcher.fetchValuation(stockId, startDate, endDate);
        totalRecords += valuationData.length;
        console.log(`✅ 估值資料: ${valuationData.length} 筆`);
      } catch (error) {
        console.error(`❌ 估值資料抓取失敗 (${stockId}):`, error);
      }

      // 抓取成長資料 (營收)
      try {
        const revenueResult = await growthFetcher.fetchRevenueData();
        if (revenueResult.success && revenueResult.data) {
          totalRecords += revenueResult.data.length;
          console.log(`✅ 營收資料: ${revenueResult.data.length} 筆`);
        } else {
          console.error('❌ 營收資料抓取失敗:', revenueResult.error);
        }
      } catch (error) {
        console.error(`❌ 營收資料抓取失敗 (${stockId}):`, error);
      }

      // 抓取成長資料 (EPS)
      try {
        const epsResult = await growthFetcher.fetchEpsData();
        if (epsResult.success && epsResult.data) {
          totalRecords += epsResult.data.length;
          console.log(`✅ EPS資料: ${epsResult.data.length} 筆`);
        } else {
          console.error('❌ EPS資料抓取失敗:', epsResult.error);
        }
      } catch (error) {
        console.error(`❌ EPS資料抓取失敗 (${stockId}):`, error);
      }

      // 抓取品質指標
      try {
        const qualityData = await qualityFetcher.fetchQualityMetrics(stockId, startDate, endDate);
        totalRecords += qualityData.length;
        console.log(`✅ 品質指標: ${qualityData.length} 筆`);
      } catch (error) {
        console.error(`❌ 品質指標抓取失敗 (${stockId}):`, error);
      }

      // 抓取資金流資料
      try {
        const fundFlowData = await fundFlowFetcher.fetchFundFlowData();
        totalRecords += fundFlowData.length;
        console.log(`✅ 資金流資料: ${fundFlowData.length} 筆`);
      } catch (error) {
        console.error(`❌ 資金流資料抓取失敗 (${stockId}):`, error);
      }

      // 小延遲避免 API 速率限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 抓取動能資料
    console.log('\n🚀 抓取動能資料...');
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
