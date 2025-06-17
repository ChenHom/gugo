// 暫時的品質資料測試腳本，跳過 DatabaseManager
import { QualityFetcher } from '../dist/fetchers/qualityFetcher.js';

async function testQuality() {
  const fetcher = new QualityFetcher();

  try {
    console.log('🧪 測試品質資料抓取...');
    const results = await fetcher.fetchQualityMetrics('2330', '2023-01-01', '2023-12-31');
    console.log('✅ 品質資料抓取成功！');
    console.log('結果:', results);
  } catch (error) {
    console.error('❌ 品質資料抓取失敗:', error);
  }
}

testQuality();
