#!/usr/bin/env node

import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

async function main() {
  const dbManager = new DatabaseManager();

  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('正在初始化資料庫...').start();
    await dbManager.initialize();
    initSpinner.succeed('資料庫初始化完成');

    const fetchSpinner = ora('開始抓取品質資料...').start();
    const fetcher = new QualityFetcher();
    const qualityData = await fetcher.fetchQualityData();
    fetchSpinner.succeed(`成功抓取 ${qualityData.length} 筆品質資料`);

    // 顯示部分樣本資料
    if (qualityData.length > 0) {
      console.log('\n📊 品質資料樣本:');
      const sample = qualityData.slice(0, 5);
      sample.forEach((data: any) => {
        console.log(`${data.stock_id} (${data.date}): ROE=${data.roe?.toFixed(2) || 'N/A'}%, 毛利率=${data.gross_margin?.toFixed(2) || 'N/A'}%`);
      });
    }

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-quality');
    console.error('❌ 抓取品質資料失敗');
    process.exit(1);
  } finally {
    await dbManager.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
