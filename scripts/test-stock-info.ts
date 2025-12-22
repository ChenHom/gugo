import { fetchFinMind } from '../src/adapters/finmind.js';

async function testStockInfo() {
  try {
    console.log('🔍 測試 FinMind TaiwanStockInfo API...\n');
    
    const data = await fetchFinMind('TaiwanStockInfo', {}, false);
    
    console.log(`✅ 總共取得 ${data.length} 筆股票資料\n`);
    
    // 顯示前 3 筆
    console.log('📋 前 3 筆資料:');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
    
    // 統計市場類型
    const marketTypes = new Map<string, number>();
    data.forEach(item => {
      const type = item.type || 'unknown';
      marketTypes.set(type, (marketTypes.get(type) || 0) + 1);
    });
    
    console.log('\n📊 各市場股票數量:');
    marketTypes.forEach((count, type) => {
      console.log(`  ${type}: ${count} 支`);
    });
    
    // 顯示一個上櫃股票範例
    const otcStock = data.find(item => item.type === 'OTC' || item.type === '上櫃');
    if (otcStock) {
      console.log('\n🎯 上櫃股票範例:');
      console.log(JSON.stringify(otcStock, null, 2));
    } else {
      console.log('\n⚠️  找不到上櫃股票');
    }
    
  } catch (error) {
    console.error('❌ 測試失敗:', error);
  }
}

testStockInfo();
