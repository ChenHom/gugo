#!/usr/bin/env node

import { GrowthFetcher } from '../dist/fetchers/growthFetcher.js';
import { FundFlowFetcher } from '../dist/fetchers/fundFlowFetcher.js';
import { defaultCache } from '../dist/utils/simpleCache.js';

async function testFinMindIntegration() {
  console.log('🚀 測試 FinMind API 整合...\n');

  // 檢查 Token 設定
  const token = process.env.FINMIND_TOKEN;
  if (token) {
    console.log('✅ FinMind Token 已設定');
  } else {
    console.log('⚠️  FinMind Token 未設定，將使用免費版本（速率限制）');
  }

  try {
    // 測試成長資料抓取
    console.log('\n📈 測試月營收資料抓取...');
    const growthFetcher = new GrowthFetcher(token);
    await growthFetcher.initialize();

    const revenueResult = await growthFetcher.fetchRevenueData({
      stockNos: ['2330'] // 只測試台積電一檔
    });

    if (revenueResult.success && revenueResult.data.length > 0) {
      console.log('✅ 月營收資料抓取成功');
      console.log(`   - 獲得 ${revenueResult.data.length} 筆資料`);
      console.log(`   - 最新資料: ${JSON.stringify(revenueResult.data[0], null, 2)}`);
    } else {
      console.log('❌ 月營收資料抓取失敗');
    }

    // 測試 EPS 資料抓取
    console.log('\n📊 測試 EPS 資料抓取...');
    const epsResult = await growthFetcher.fetchEpsData({
      stockNos: ['2330']
    });

    if (epsResult.success && epsResult.data.length > 0) {
      console.log('✅ EPS 資料抓取成功');
      console.log(`   - 獲得 ${epsResult.data.length} 筆資料`);
    } else {
      console.log('❌ EPS 資料抓取失敗');
    }

    // 測試資金流資料抓取
    console.log('\n💰 測試資金流資料抓取...');
    const fundFlowFetcher = new FundFlowFetcher(token);
    const fundFlowData = await fundFlowFetcher.fetchFundFlowData(['2330']);

    if (fundFlowData.length > 0) {
      console.log('✅ 資金流資料抓取成功');
      console.log(`   - 獲得 ${fundFlowData.length} 筆資料`);
    } else {
      console.log('❌ 資金流資料抓取失敗');
    }

    // 測試快取功能
    console.log('\n🗄️  測試快取功能...');
    await defaultCache.set('test_key', { message: 'Hello Cache!' }, 1);
    const cachedData = await defaultCache.get('test_key');
    if (cachedData) {
      console.log('✅ 快取功能正常');
    } else {
      console.log('❌ 快取功能異常');
    }

    console.log('\n🎉 FinMind API 整合測試完成！');

  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);

    if (error.message?.includes('429')) {
      console.log('\n💡 建議：您可能遇到速率限制，請：');
      console.log('   1. 等待一分鐘後重試');
      console.log('   2. 設定 FinMind Token 以提高速率限制');
      console.log('   3. 檢查 .env 檔案中的 FINMIND_TOKEN 設定');
    }
  }
}

// 只有直接執行此檔案時才運行測試
if (import.meta.url === `file://${process.argv[1]}`) {
  testFinMindIntegration().catch(console.error);
}

export { testFinMindIntegration };
