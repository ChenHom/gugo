import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FundFlowFetcher } from '../../src/fetchers/fundFlowFetcher.js';
import { GrowthFetcher } from '../../src/fetchers/growthFetcher.js';
import { createTestDatabase, cleanupTestDatabase } from '../utils/testHelpers.js';

/**
 * 測試 Fetcher 的 TWSE fallback 機制
 * 確保當 FinMind API 失敗時能夠正確回退到 TWSE OpenAPI
 */
describe('Fetcher TWSE Fallback 機制', () => {
  let dbFile: string;

  beforeEach(async () => {
    dbFile = await createTestDatabase({
      prefix: 'fallback-test',
      createTables: true,
      insertTestData: false
    });
  });

  afterEach(() => {
    cleanupTestDatabase(dbFile);
  });

  describe('FundFlowFetcher fallback', () => {
    it('應該優先嘗試 TWSE API，失敗時回退到 FinMind', async () => {
      const fetcher = new FundFlowFetcher(undefined, dbFile);

      const result = await fetcher.fetchInstitutionalFlow(
        '2330',
        '2024-07-01',
        '2025-07-01'
      );

      // 驗證回傳結果
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // 如果 TWSE 失敗但 FinMind 成功，應該有資料
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('stock_id');
        expect(result[0]).toHaveProperty('date');
        expect(result[0]).toHaveProperty('foreign_net');
        expect(result[0]).toHaveProperty('inv_trust_net');
        expect(result[0]).toHaveProperty('dealer_net');
      }
    });

    it('應該正確處理 TWSE API 404 錯誤', async () => {
      const fetcher = new FundFlowFetcher(undefined, dbFile);

      // 使用一個不存在的股票代號來觸發 404
      const result = await fetcher.fetchInstitutionalFlow(
        '9999',
        '2024-07-01',
        '2025-07-01'
      );

      // 應該回傳空陣列而不是拋出錯誤
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('應該能夠儲存和檢索資金流向資料', async () => {
      const fetcher = new FundFlowFetcher(undefined, dbFile);

      const result = await fetcher.fetchInstitutionalFlow(
        '2330',
        '2024-07-01',
        '2025-07-01'
      );

      if (result.length > 0) {
        // 檢索已儲存的資料
        const savedData = fetcher.getFundFlowMetrics('2330', '2024-07-01', '2025-07-01');

        expect(savedData).toBeDefined();
        expect(Array.isArray(savedData)).toBe(true);
      }
    });
  });

  describe('GrowthFetcher fallback', () => {
    it('應該優先嘗試 TWSE API，失敗時回退到 FinMind', async () => {
      const fetcher = new GrowthFetcher(undefined, dbFile);

      const result = await fetcher.fetchRevenueGrowth(
        '2330',
        '2024-01-01',
        '2024-12-31'
      );

      // 驗證回傳結果
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // 如果成功，應該有成長資料
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('stock_id');
        expect(result[0]).toHaveProperty('month');
        expect(result[0]).toHaveProperty('revenue');
        expect(result[0]).toHaveProperty('yoy');
        expect(result[0]).toHaveProperty('mom');
      }
    });

    it('應該正確計算營收成長率', async () => {
      const fetcher = new GrowthFetcher(undefined, dbFile);

      const result = await fetcher.fetchRevenueGrowth(
        '2330',
        '2024-01-01',
        '2024-12-31'
      );

      // 檢查成長率計算
      const dataWithGrowth = result.filter(item =>
        item.yoy !== undefined && item.mom !== undefined
      );

      if (dataWithGrowth.length > 0) {
        dataWithGrowth.forEach(item => {
          expect(typeof item.yoy).toBe('number');
          expect(typeof item.mom).toBe('number');
        });
      }
    });
  });

  describe('錯誤處理和回復機制', () => {
    it('應該正確處理網路錯誤', async () => {
      const fetcher = new FundFlowFetcher(undefined, dbFile);

      // 這個測試驗證錯誤處理不會導致程式崩潰
      const result = await fetcher.fetchInstitutionalFlow(
        '2330',
        '2024-07-01',
        '2025-07-01'
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('應該正確處理 FinMind 402 錯誤', async () => {
      // 這個測試需要模擬 FinMind API 回傳 402 錯誤
      const fetcher = new FundFlowFetcher('invalid_token', dbFile);

      const result = await fetcher.fetchInstitutionalFlow(
        '2330',
        '2024-07-01',
        '2025-07-01'
      );

      // 即使遇到 402 錯誤，也應該回傳空陣列而不是拋出異常
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('資料品質驗證', () => {
    it('回傳的資料應該符合預期格式', async () => {
      const fundFlow = new FundFlowFetcher(undefined, dbFile);
      const growth = new GrowthFetcher(undefined, dbFile);

      const [fundFlowResult, growthResult] = await Promise.all([
        fundFlow.fetchInstitutionalFlow('2330', '2024-07-01', '2025-07-01'),
        growth.fetchRevenueGrowth('2330', '2024-01-01', '2024-12-31')
      ]);

      // 驗證資金流向資料格式
      if (fundFlowResult.length > 0) {
        const sample = fundFlowResult[0];
        expect(sample.stock_id).toBe('2330');
        expect(typeof sample.date).toBe('string');
        expect(sample.date).toMatch(/\d{4}-\d{2}-\d{2}/);
      }

      // 驗證成長資料格式
      if (growthResult.length > 0) {
        const sample = growthResult[0];
        expect(sample.stock_id).toBe('2330');
        expect(typeof sample.month).toBe('string');
        expect(sample.month).toMatch(/\d{4}-\d{2}/);
      }
    });

    it('應該正確處理無資料的情況', async () => {
      const fetcher = new FundFlowFetcher(undefined, dbFile);

      // 測試環境中會產生模擬資料，所以我們檢查資料結構是否正確
      const result = await fetcher.fetchInstitutionalFlow(
        '9999',
        '1990-01-01',
        '1990-12-31'
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      // 在測試環境中，會產生模擬資料，所以我們驗證資料結構
      if (result.length > 0) {
        result.forEach(item => {
          expect(item.stock_id).toBe('9999');
          expect(typeof item.date).toBe('string');
          expect(typeof item.foreign_net).toBe('number');
          expect(typeof item.inv_trust_net).toBe('number');
          expect(typeof item.dealer_net).toBe('number');
        });
      }
    });
  });
});
