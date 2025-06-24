import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FinMindClient } from '../../../src/utils/finmindClient.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('FinMindClient request generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 預設成功回應
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 200,
        msg: 'Success',
        data: []
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds correct URL for getFinancialStatements', async () => {
    const client = new FinMindClient();
    await client.getFinancialStatements('2330', '2024-01-01', '2024-12-31');

    expect(mockFetch).toHaveBeenCalled();
    const call = mockFetch.mock.calls[0];
    const url = new URL(call[0]);
    expect(url.searchParams.get('dataset')).toBe('TaiwanStockFinancialStatements');
    expect(url.searchParams.get('data_id')).toBe('2330');
    expect(url.searchParams.get('start_date')).toBe('2024-01-01');
    expect(url.searchParams.get('end_date')).toBe('2024-12-31');
  });

  it('builds correct URL for getInstitutionalInvestors with token', async () => {
    const client = new FinMindClient('test-token');
    await client.getInstitutionalInvestors('2330', '2024-01-01', '2024-12-31');

    expect(mockFetch).toHaveBeenCalled();
    const call = mockFetch.mock.calls[0];
    const url = new URL(call[0]);
    expect(url.searchParams.get('dataset')).toBe('TaiwanStockInstitutionalInvestorsBuySell');
    expect(url.searchParams.get('token')).toBe('test-token');
  });
});

describe('FinMindClient 404 error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles 404 Not Found gracefully for getMonthlyRevenue', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new FinMindClient();
    const result = await client.getMonthlyRevenue('9999', '2024-01-01', '2024-12-31');

    expect(result).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith('⚠️  9999 該期間無月營收資料');

    logSpy.mockRestore();
  });

  it('handles 404 Not Found gracefully for getInstitutionalInvestors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new FinMindClient();
    const result = await client.getInstitutionalInvestors('9999', '2024-01-01', '2024-12-31');

    expect(result).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith('⚠️  9999 該期間無三大法人買賣超資料');

    logSpy.mockRestore();
  });

  it('handles 404 Not Found gracefully for getFinancialStatements', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const client = new FinMindClient();
    const result = await client.getFinancialStatements('9999', '2024-01-01', '2024-12-31');

    expect(result).toEqual([]);
    expect(logSpy).toHaveBeenCalledWith('⚠️  9999 該期間無財務報表資料');

    logSpy.mockRestore();
  });

  it('throws error for non-404 HTTP errors', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const client = new FinMindClient();

    await expect(client.getMonthlyRevenue('2330', '2024-01-01', '2024-03-01'))
      .rejects
      .toThrow('FinMind API request failed: 500 Internal Server Error');

    consoleErrorSpy.mockRestore();
  });

  it('returns empty array when API returns empty data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 200,
        msg: 'Success',
        data: []
      })
    });

    const client = new FinMindClient();
    const result = await client.getMonthlyRevenue('2330', '2024-01-01', '2024-12-31');

    expect(result).toEqual([]);
  });
});
