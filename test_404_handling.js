#!/usr/bin/env node

import { FinMindClient } from './dist/utils/finmindClient.js';

async function testErrorHandling() {
  const client = new FinMindClient();

  console.log('=== 測試 FinMind API 404 錯誤處理 ===\n');

  // 測試 1：正常的股票代碼
  console.log('1. 測試正常股票代碼 (2330)');
  try {
    const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-03-01');
    console.log(`✅ 成功獲取 ${result.length} 筆資料`);
  } catch (error) {
    console.log(`❌ 錯誤:`, error);
  }

  console.log('\n2. 測試不存在的股票代碼 (9999)');
  try {
    const result = await client.getMonthlyRevenue('9999', '2024-01-01', '2024-03-01');
    console.log(`✅ 處理成功，回傳 ${result.length} 筆資料（預期為 0）`);
  } catch (error) {
    console.log(`❌ 錯誤:`, error);
  }

  console.log('\n3. 測試三大法人資料 - 不存在的股票代碼');
  try {
    const result = await client.getInstitutionalInvestors('9999', '2024-01-01', '2024-03-01');
    console.log(`✅ 處理成功，回傳 ${result.length} 筆資料（預期為 0）`);
  } catch (error) {
    console.log(`❌ 錯誤:`, error);
  }

  console.log('\n=== 測試完成 ===');
}

testErrorHandling().catch(console.error);
