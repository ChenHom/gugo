import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FinMindClient } from '../../../src/utils/finmindClient.js';

// Mock global fetch function
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Fetchers Comprehensive Integration Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FinMindClient Basic Functionality', () => {
    it('successfully fetches monthly revenue data', async () => {
      const client = new FinMindClient();

      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          msg: 'Success',
          data: [
            {
              date: '2024-01-01',
              stock_id: '2330',
              revenue: 176299866000,
              revenue_month: 12,
              revenue_year: 2023
            }
          ]
        })
      });

      const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-01-31');

      expect(result).toHaveLength(1);
      expect(result[0]?.stock_id).toBe('2330');
      expect(result[0]?.revenue).toBe(176299866000);
    });

    it('successfully fetches financial statements data', async () => {
      const client = new FinMindClient();

      // Mock successful response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          msg: 'Success',
          data: [
            {
              date: '2024-01-01',
              stock_id: '2330',
              type: 'Consolidated Income Statement',
              value: 100000,
              origin_name: 'Total Revenue'
            }
          ]
        })
      });

      const result = await client.getFinancialStatements('2330', '2024-01-01', '2024-01-31');

      expect(result).toHaveLength(1);
      expect(result[0]?.stock_id).toBe('2330');
      expect(result[0]?.type).toBe('Consolidated Income Statement');
    });

    it('handles 404 errors gracefully', async () => {
      const client = new FinMindClient();

      // Mock 404 response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await client.getMonthlyRevenue('9999', '2024-01-01', '2024-01-31');

      expect(result).toEqual([]);
      expect(logSpy).toHaveBeenCalledWith('⚠️  9999 該期間無月營收資料');

      logSpy.mockRestore();
    });

    it('handles empty data responses', async () => {
      const client = new FinMindClient();

      // Mock empty response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          status: 200,
          msg: 'Success',
          data: []
        })
      });

      const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-01-31');

      expect(result).toEqual([]);
    });
  });
});
