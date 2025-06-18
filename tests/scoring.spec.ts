import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calcScore } from '../src/services/scoringEngine.js';
import * as db from '../src/db.js';

type QueryMock = ReturnType<typeof vi.fn>;
vi.mock('../src/db.js', () => ({ query: vi.fn(), close: vi.fn() }));

const query = db.query as unknown as QueryMock;

const valuationRows = [
  { stock_no: '1111', per: 10, pbr: 1, dividend_yield: 5 },
  { stock_no: '2222', per: 20, pbr: 2, dividend_yield: 3 },
];
const growthRows = [
  { stock_no: '1111', yoy: 10, mom: 5, eps_qoq: 2 },
  { stock_no: '2222', yoy: 5, mom: 2, eps_qoq: 1 },
];
const qualityRows = [
  { stock_no: '1111', roe: 15, gross_margin: 30, op_margin: 20 },
  { stock_no: '2222', roe: 10, gross_margin: 25, op_margin: 15 },
];
const fundRows = [
  { stock_no: '1111', foreign_net: 100, inv_trust_net: 50 },
  { stock_no: '2222', foreign_net: 50, inv_trust_net: 20 },
];
const priceRows = [
  { stock_no: '1111', close: 100 },
  { stock_no: '2222', close: 80 },
];

function setupMocks() {
  query.mockImplementation((sql: string) => {
    if (sql.includes('FROM valuation')) {
      if (sql.startsWith('SELECT MAX')) return [{ date: '2024-01-01' }];
      return valuationRows;
    }
    if (sql.includes('FROM growth')) {
      if (sql.startsWith('SELECT MAX')) return [{ month: '2024-01' }];
      return growthRows;
    }
    if (sql.includes('FROM quality')) {
      if (sql.startsWith('SELECT MAX')) return [{ year: 2024 }];
      return qualityRows;
    }
    if (sql.includes('FROM fundflow')) {
      if (sql.startsWith('SELECT MAX')) return [{ date: '2024-01-01' }];
      return fundRows;
    }
    if (sql.includes('FROM price_daily')) {
      if (sql.startsWith('SELECT MAX')) return [{ date: '2024-01-01' }];
      return priceRows;
    }
    return [];
  });
}

describe('calcScore', () => {
  beforeEach(() => {
    query.mockReset();
    setupMocks();
  });

  it('calculates total score within range', async () => {
    const res = await calcScore('1111');
    expect(res.total).toBeGreaterThanOrEqual(0);
    expect(res.total).toBeLessThanOrEqual(100);
    expect(res.missing).toEqual([]);
  });

  it('handles missing data', async () => {
    growthRows[0]!.yoy = undefined as any;
    const res = await calcScore('1111');
    expect(res.missing).toContain('yoy');
    growthRows[0]!.yoy = 10;
  });

  it('normalizes custom weights', async () => {
    const res = await calcScore('1111', { valuation: 80, growth: 10, quality: 5, chips: 3, momentum: 2 });
    expect(res.total).toBeGreaterThanOrEqual(0);
  });

  it('returns zero when stock not found', async () => {
    const res = await calcScore('9999');
    expect(res.total).toBe(0);
    expect(res.missing.length).toBeGreaterThan(0);
  });

  it('handles zero std dev', async () => {
    valuationRows[0]!.per = 10;
    valuationRows[1]!.per = 10;
    const res = await calcScore('1111');
    expect(res.valuation).toBeGreaterThan(0);
  });

  it('partial weights are normalized', async () => {
    const res = await calcScore('1111', { valuation: 1 });
    expect(res.total).toBeGreaterThan(0);
  });
});
