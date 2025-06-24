import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FinMindClient } from '../../../src/utils/finmindClient.js';

// Mock global fetch function
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('Fetcher Error Handling', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('FinMindClient Network Error Scenarios', () => {
    it('handles network timeout gracefully', async () => {
      const client = new FinMindClient();

      // Mock network timeout
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31'))
        .rejects
        .toThrow('Network timeout');

      consoleSpy.mockRestore();
    });

    it('handles API rate limiting', async () => {
      const client = new FinMindClient();

      // Mock rate limiting response
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({ status: 429, msg: 'Rate limit exceeded' })
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31'))
        .rejects
        .toThrow('FinMind API request failed: 429 Too Many Requests');

      expect(consoleSpy).toHaveBeenCalledWith('❌ FinMind API 請求失敗: TaiwanStockMonthRevenue - 429 Too Many Requests');

      consoleSpy.mockRestore();
    });

    it('handles malformed JSON response', async () => {
      const client = new FinMindClient();

      // Mock malformed JSON response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        }
      });

      await expect(client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31'))
        .rejects
        .toThrow('Unexpected token in JSON');
    });

    it('handles server errors (500)', async () => {
      const client = new FinMindClient();

      // Mock server error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ status: 500, msg: 'Server error' })
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31'))
        .rejects
        .toThrow('FinMind API request failed: 500 Internal Server Error');

      expect(consoleSpy).toHaveBeenCalledWith('❌ FinMind API 請求失敗: TaiwanStockMonthRevenue - 500 Internal Server Error');

      consoleSpy.mockRestore();
    });

    it('handles 404 with proper warning message', async () => {
      const client = new FinMindClient();

      // Mock 404 Not Found
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ status: 404, msg: 'Not Found' })
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31');

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  2330 該期間無月營收資料');

      consoleSpy.mockRestore();
    });
  });

  describe('Data Validation and Sanitization', () => {
    it('handles empty response data', async () => {
      const client = new FinMindClient();

      // Mock empty response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 200, msg: 'Success', data: [] })
      });

      const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31');
      expect(result).toEqual([]);
    });

    it('handles null response data', async () => {
      const client = new FinMindClient();

      // Mock null response
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 200, msg: 'Success', data: null })
      });

      const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31');
      expect(result).toEqual([]);
    });
  });
});