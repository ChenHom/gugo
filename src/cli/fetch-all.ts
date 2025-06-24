#!/usr/bin/env node
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { StockListService } from '../services/stockListService.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';

export async function run(): Promise<void> {
  await ErrorHandler.initialize();

  // 初始化股票清單服務
  const stockListService = new StockListService();
  await stockListService.initialize();

  // 檢查並更新股票清單（如果超過 24 小時）
  const stats = stockListService.getStockListStats();
  const lastUpdated = stats.lastUpdated;
  const shouldUpdate = !lastUpdated ||
    (Date.now() - new Date(lastUpdated).getTime()) > 24 * 60 * 60 * 1000;

  if (shouldUpdate) {
    const updateSpin = ora('更新股票清單').start();
    try {
      await stockListService.updateStockList();
      updateSpin.succeed('股票清單更新完成');
    } catch (error) {
      updateSpin.fail('股票清單更新失敗');
      await ErrorHandler.logError(error as Error, 'fetch-all:stock-list-update');
    }
  }

  // 取得所有股票代碼
  const allStocks = stockListService.getAllStocks();
  const stockCodes = allStocks.map(stock => stock.stockNo);

  console.log(`📊 將抓取 ${stockCodes.length} 支股票的資料`);

  const valuation = new ValuationFetcher();
  const growth = new GrowthFetcher();
  const quality = new QualityFetcher();
  const fund = new FundFlowFetcher();
  const momentum = new MomentumFetcher();

  await Promise.all([
    (async () => {
      const spin = ora('Valuation').start();
      try {
        await valuation.initialize();
        await valuation.fetchValuationData({
          stockNos: stockCodes,
          useCache: true
        });
        spin.succeed('Valuation 完成');
      } catch (err) {
        spin.fail('Valuation 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:valuation');
        console.error('Valuation fetcher failed');
      } finally {
        await valuation.close();
      }
    })(),
    (async () => {
      const spin = ora('Growth').start();
      try {
        await growth.initialize();
        await growth.fetchRevenueData({
          stockNos: stockCodes,
          useCache: true
        });
        await growth.fetchEpsData({
          stockNos: stockCodes,
          useCache: true
        });
        spin.succeed('Growth 完成');
      } catch (err) {
        spin.fail('Growth 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:growth');
        console.error('Growth fetcher failed');
      } finally {
        await growth.close();
      }
    })(),
    (async () => {
      const spin = ora('Quality').start();
      try {
        await quality.initialize();
        // 為所有股票抓取品質資料
        for (const stockCode of stockCodes) {
          await quality.fetchQualityMetrics(stockCode, '2020-01-01');
        }
        spin.succeed('Quality 完成');
      } catch (err) {
        spin.fail('Quality 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:quality');
        console.error('Quality fetcher failed');
      } finally {
        await quality.close();
      }
    })(),
    (async () => {
      const spin = ora('Fund flow').start();
      try {
        await fund.initialize();
        await fund.fetchFundFlowData({
          stockNos: stockCodes,
          useCache: true
        });
        spin.succeed('Fund flow 完成');
      } catch (err) {
        spin.fail('Fund flow 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:fund-flow');
        console.error('Fund flow fetcher failed');
      } finally {
        await fund.close();
      }
    })(),
    (async () => {
      const spin = ora('Momentum').start();
      try {
        await momentum.initialize();
        await momentum.fetchMomentumData(stockCodes);
        spin.succeed('Momentum 完成');
      } catch (err) {
        spin.fail('Momentum 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:momentum');
        console.error('Momentum fetcher failed');
      } finally {
        await momentum.close();
      }
    })(),
  ]);

  // 關閉股票清單服務
  stockListService.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
