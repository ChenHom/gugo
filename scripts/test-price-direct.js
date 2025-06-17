// 測試價格資料抓取器
import { PriceFetcher } from '../dist/fetchers/priceFetcher.js';

async function testPrice() {
  const fetcher = new PriceFetcher();

  try {
    console.log('📈 測試股價資料抓取...');
    const priceResults = await fetcher.fetchStockPrice('2330', '2023-01-01', '2023-01-31');
    console.log('✅ 股價資料抓取成功！數量:', priceResults.length);
    if (priceResults.length > 0) {
      console.log('範例資料:', priceResults[0]);
    }

    console.log('📊 測試估值資料抓取...');
    const valuationResults = await fetcher.fetchValuation('2330', '2023-01-01', '2023-01-31');
    console.log('✅ 估值資料抓取成功！數量:', valuationResults.length);
    if (valuationResults.length > 0) {
      console.log('範例資料:', valuationResults[0]);
    }
  } catch (error) {
    console.error('❌ 資料抓取失敗:', error);
  }
}

testPrice();
