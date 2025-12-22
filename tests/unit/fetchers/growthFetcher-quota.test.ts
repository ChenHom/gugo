import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GrowthFetcher } from '../../../src/fetchers/growthFetcher.js';
import { QuotaExceededError } from '../../../src/utils/errors.js';
import fs from 'fs';

describe('GrowthFetcher - 402 配額錯誤處理', () => {
  let fetcher: GrowthFetcher;
  const testDbPath = 'data/test-growth-quota.db';

  beforeEach(async () => {
    // 清理測試資料庫
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    fetcher = new GrowthFetcher('test-token', testDbPath);
    await fetcher.initialize();
  });

  afterEach(() => {
    fetcher.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('fetchRevenueGrowth', () => {
    it('應該在遇到 402 Payment Required 時拋出 QuotaExceededError', async () => {
      // Spy on the finmindClient's method
      const mockGetMonthlyRevenue = vi.spyOn((fetcher as any).finmindClient, 'getMonthlyRevenue')
        .mockRejectedValue(new Error('402 Payment Required - FinMind API quota exceeded'));

      // 執行並預期拋出 QuotaExceededError
      await expect(
        fetcher.fetchRevenueGrowth('2330', '2024-01-01', '2024-12-31')
      ).rejects.toThrow(QuotaExceededError);

      // 驗證 mock 被調用
      expect(mockGetMonthlyRevenue).toHaveBeenCalled();
      
      // 清理
      mockGetMonthlyRevenue.mockRestore();
    });

    it('應該在遇到 404 錯誤時回傳空陣列而非拋出', async () => {
      // Spy on the finmindClient's method
      const mockGetMonthlyRevenue = vi.spyOn((fetcher as any).finmindClient, 'getMonthlyRevenue')
        .mockRejectedValue(new Error('404 Not Found'));

      // 執行並預期回傳空陣列
      const result = await fetcher.fetchRevenueGrowth('9999', '2024-01-01', '2024-12-31');
      expect(result).toEqual([]);

      // 驗證 mock 被調用
      expect(mockGetMonthlyRevenue).toHaveBeenCalled();
      
      // 清理
      mockGetMonthlyRevenue.mockRestore();
    });
  });

  describe('fetchEpsData', () => {
    it('應該在遇到 402 Payment Required 時回傳 success: false', async () => {
      // Spy on the finmindClient's methods
      const mockGetFinancialStatements = vi.spyOn((fetcher as any).finmindClient, 'getFinancialStatements')
        .mockRejectedValue(new Error('402 Payment Required - FinMind API quota exceeded for TaiwanStockFinancialStatements'));

      // 執行並檢查回傳值
      const result = await fetcher.fetchEpsData({ stockNos: ['2330'] });
      
      // fetchEpsData 會捕獲錯誤並回傳 {success: false, error: ...}
      expect(result.success).toBe(false);
      expect(result.error).toContain('配額已用盡');

      // 驗證 mock 被調用
      expect(mockGetFinancialStatements).toHaveBeenCalled();
      
      // 清理
      mockGetFinancialStatements.mockRestore();
    });

    it('應該在遇到其他錯誤時回傳 success: true 但 data 為空', async () => {
      // Spy on the finmindClient's methods
      const mockGetFinancialStatements = vi.spyOn((fetcher as any).finmindClient, 'getFinancialStatements')
        .mockRejectedValue(new Error('Network timeout'));

      // 執行並預期回傳 success: true, data: []
      // (因為對於非配額錯誤，會記錄警告並繼續處理，最後回傳空資料)
      const result = await fetcher.fetchEpsData({ stockNos: ['2330'] });
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);

      // 驗證 mock 被調用
      expect(mockGetFinancialStatements).toHaveBeenCalled();
      
      // 清理
      mockGetFinancialStatements.mockRestore();
    });
  });

  describe('fetchRevenueData', () => {
    it('應該在遇到 402 Payment Required 時回傳 success: false', async () => {
      // Spy on the finmindClient's method
      const mockGetMonthlyRevenue = vi.spyOn((fetcher as any).finmindClient, 'getMonthlyRevenue')
        .mockRejectedValue(new Error('402 Payment Required - FinMind API quota exceeded'));

      // 執行並檢查回傳值
      const result = await fetcher.fetchRevenueData({ stockNos: ['2330'] });
      
      // fetchRevenueData 會捕獲錯誤並回傳 {success: false, error: ...}
      expect(result.success).toBe(false);
      expect(result.error).toContain('配額已用盡');

      // 驗證 mock 被調用
      expect(mockGetMonthlyRevenue).toHaveBeenCalled();
      
      // 清理
      mockGetMonthlyRevenue.mockRestore();
    });

    it('應該在遇到其他錯誤時回傳 success: true 但 data 為空', async () => {
      // Spy on the finmindClient's method
      const mockGetMonthlyRevenue = vi.spyOn((fetcher as any).finmindClient, 'getMonthlyRevenue')
        .mockRejectedValue(new Error('Network timeout'));

      // 執行並預期回傳 success: true, data: []
      const result = await fetcher.fetchRevenueData({ stockNos: ['2330'] });
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);

      // 驗證 mock 被調用
      expect(mockGetMonthlyRevenue).toHaveBeenCalled();
      
      // 清理
      mockGetMonthlyRevenue.mockRestore();
    });
  });
});
