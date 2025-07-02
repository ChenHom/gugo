import { describe, it, expect, beforeAll } from 'vitest';
import { FundFlowFetcher } from '../../src/fetchers/fundFlowFetcher.js';
import { GrowthFetcher } from '../../src/fetchers/growthFetcher.js';
import { ValuationFetcher } from '../../src/fetchers/valuationFetcher.js';
import { QualityFetcher } from '../../src/fetchers/qualityFetcher.js';
import { PriceFetcher } from '../../src/fetchers/priceFetcher.js';
import { MomentumFetcher } from '../../src/fetchers/momentumFetcher.js';

/**
 * 測試 TWSE 優先、FinMind 備用的 fallback 機制
 */
describe('Fetchers Fallback 機制測試', () => {
  // 測試股票代號
  const testStocks = ['2330', '2454', '2317'];

  // 使用過去一年的日期而非未來日期，確保能取得真實數據
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];

  // 模擬測試環境
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  describe('FundFlowFetcher', () => {
    let fetcher: FundFlowFetcher;

    beforeAll(async () => {
      fetcher = new FundFlowFetcher();
      await fetcher.initialize();
    });

    it.each(testStocks)('可成功取得 %s 資金流向資料', async (stock) => {
      const result = await fetcher.fetchInstitutionalFlow(stock, startDate, endDate);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('GrowthFetcher', () => {
    let fetcher: GrowthFetcher;

    beforeAll(async () => {
      fetcher = new GrowthFetcher();
      await fetcher.initialize();
    });

    it.each(testStocks)('可成功取得 %s 營收成長資料', async (stock) => {
      const result = await fetcher.fetchRevenueGrowth(stock, startDate, endDate);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('ValuationFetcher', () => {
    let fetcher: ValuationFetcher;

    beforeAll(async () => {
      fetcher = new ValuationFetcher();
      await fetcher.initialize();
    });

    it.each(testStocks)('可成功取得 %s 估值資料', async (stock) => {
      const result = await fetcher.fetchValuationData({
        stockNos: [stock],
        date: new Date().toISOString().split('T')[0]
      });
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
    });
  });

  describe('MomentumFetcher', () => {
    let fetcher: MomentumFetcher;

    beforeAll(async () => {
      fetcher = new MomentumFetcher();
      await fetcher.initialize();
    });

    it('可成功計算多支股票的動能指標', async () => {
      const result = await fetcher.fetchMomentumData(testStocks);
      expect(result.length).toBe(testStocks.length);
    });
  });

  describe('QualityFetcher', () => {
    let fetcher: QualityFetcher;

    beforeAll(async () => {
      fetcher = new QualityFetcher();
      await fetcher.initialize();
    });

    it.each(testStocks)('可成功取得 %s 品質指標資料', async (stock) => {
      const result = await fetcher.fetchQualityMetrics(stock, startDate);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('PriceFetcher', () => {
    let fetcher: PriceFetcher;

    beforeAll(async () => {
      fetcher = new PriceFetcher();
      await fetcher.initialize();
    });

    it.each(testStocks)('可成功取得 %s 股價資料', async (stock) => {
      const priceData = await fetcher.fetchStockPrice(stock, startDate, endDate);
      expect(priceData.length).toBeGreaterThan(0);

      const valuationData = await fetcher.fetchValuation(stock, startDate, endDate);
      expect(valuationData.length).toBeGreaterThan(0);
    });
  });
});
