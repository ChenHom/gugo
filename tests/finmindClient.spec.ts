import { describe, it, expect, beforeEach, vi } from 'vitest';

let fetchMock: any;
vi.mock('node-fetch', () => ({
  default: (...args: any[]) => fetchMock(...args),
}));

import { FinMindClient } from '../src/utils/finmindClient.js';
import { defaultCache } from '../src/utils/simpleCache.js';

describe('FinMindClient request generation', () => {
  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, msg: 'ok', data: [] }),
    });
    vi.spyOn(defaultCache, 'get').mockResolvedValue(null);
    vi.spyOn(defaultCache, 'set').mockResolvedValue();
  });

  it('builds correct URL for getFinancialStatements', async () => {
    const client = new FinMindClient();
    await client.getFinancialStatements('2330', '2024-01-01', '2024-12-31');
    expect(fetchMock).toHaveBeenCalled();
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('dataset')).toBe('TaiwanStockFinancialStatements');
    expect(url.searchParams.get('data_id')).toBe('2330');
    expect(url.searchParams.get('start_date')).toBe('2024-01-01');
    expect(url.searchParams.get('end_date')).toBe('2024-12-31');
    expect(url.searchParams.get('token')).toBeNull();
  });

  it('builds correct URL for getInstitutionalInvestors with token', async () => {
    const client = new FinMindClient('test-token');
    await client.getInstitutionalInvestors('2330', '2024-01-01', '2024-12-31');
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('dataset')).toBe('TaiwanStockInstitutionalInvestorsBuySell');
    expect(url.searchParams.get('data_id')).toBe('2330');
    expect(url.searchParams.get('start_date')).toBe('2024-01-01');
    expect(url.searchParams.get('end_date')).toBe('2024-12-31');
    expect(url.searchParams.get('token')).toBe('test-token');
  });
});
