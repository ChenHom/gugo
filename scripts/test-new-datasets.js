#!/usr/bin/env node

// 測試新的 FinMind 資料集
import { FinMindClient } from '../dist/utils/finmindClient.js';

async function testNewDatasets() {
  console.log('🚀 測試新的 FinMind 資料集...');

  const client = new FinMindClient();
  const stockId = '2330';
  const startDate = '2023-01-01';
  const endDate = '2023-12-31';

  try {
    // 測試股價資料
    console.log('\n📈 測試股價資料...');
    const priceData = await client.getStockPrice(stockId, startDate, endDate);
    console.log(`✅ 股價資料: ${priceData.length} 筆`);
    if (priceData.length > 0) {
      console.log('   範例:', priceData[0]);
    }
  } catch (error) {
    console.error('❌ 股價資料失敗:', error.message);
  }

  try {
    // 測試 PER/PBR 資料
    console.log('\n📊 測試 PER/PBR 資料...');
    const perData = await client.getStockPER(stockId, startDate, endDate);
    console.log(`✅ PER/PBR 資料: ${perData.length} 筆`);
    if (perData.length > 0) {
      console.log('   範例:', perData[0]);
    }
  } catch (error) {
    console.error('❌ PER/PBR 資料失敗:', error.message);
  }

  try {
    // 測試資產負債表
    console.log('\n🏦 測試資產負債表...');
    const balanceData = await client.getBalanceSheet(stockId, startDate, endDate);
    console.log(`✅ 資產負債表: ${balanceData.length} 筆`);
    if (balanceData.length > 0) {
      console.log('   範例:', balanceData[0]);
    }
  } catch (error) {
    console.error('❌ 資產負債表失敗:', error.message);
  }

  try {
    // 測試現金流量表
    console.log('\n💰 測試現金流量表...');
    const cashFlowData = await client.getCashFlow(stockId, startDate, endDate);
    console.log(`✅ 現金流量表: ${cashFlowData.length} 筆`);
    if (cashFlowData.length > 0) {
      console.log('   範例:', cashFlowData[0]);
    }
  } catch (error) {
    console.error('❌ 現金流量表失敗:', error.message);
  }

  try {
    // 測試股利政策
    console.log('\n💸 測試股利政策...');
    const dividendData = await client.getDividend(stockId, startDate, endDate);
    console.log(`✅ 股利政策: ${dividendData.length} 筆`);
    if (dividendData.length > 0) {
      console.log('   範例:', dividendData[0]);
    }
  } catch (error) {
    console.error('❌ 股利政策失敗:', error.message);
  }

  try {
    // 測試市值資料
    console.log('\n🏢 測試市值資料...');
    const marketValueData = await client.getMarketValue(stockId, startDate, endDate);
    console.log(`✅ 市值資料: ${marketValueData.length} 筆`);
    if (marketValueData.length > 0) {
      console.log('   範例:', marketValueData[0]);
    }
  } catch (error) {
    console.error('❌ 市值資料失敗:', error.message);
  }

  console.log('\n🎉 測試完成！');
}

testNewDatasets().catch(console.error);
