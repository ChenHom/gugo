import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calcScore } from '../../../src/services/scoringEngine.js';
import * as db from '../../../src/db.js';

type QueryMock = ReturnType<typeof vi.fn>;
vi.mock('../../../src/db.js', () => ({ query: vi.fn(), close: vi.fn() }));

const query = db.query as unknown as QueryMock;

const valuationRows = [
  { stock_no: '1111', per: 10, pbr: 1, dividend_yield: 5, date: '2024-02-01' },
  { stock_no: '1111', per: 12, pbr: 1.1, dividend_yield: 4.8, date: '2024-01-01' },
  { stock_no: '2222', per: 20, pbr: 2, dividend_yield: 3, date: '2024-02-01' },
  { stock_no: '3333', per: 15, pbr: 1.5, dividend_yield: 4, date: '2024-02-01' },
];
const growthRows = [
  { stock_no: '1111', yoy: 10, mom: 5, eps_qoq: 2, month: '2024-02' },
  { stock_no: '1111', yoy: 9, mom: 4, eps_qoq: 1.8, month: '2024-01' },
  { stock_no: '2222', yoy: 5, mom: 2, eps_qoq: 1, month: '2024-02' },
  { stock_no: '3333', yoy: 8, mom: 3, eps_qoq: 1.5, month: '2024-02' },
];
const qualityRows = [
  { stock_no: '1111', roe: 15, gross_margin: 30, op_margin: 20, year: 2024 },
  { stock_no: '1111', roe: 14, gross_margin: 29, op_margin: 19, year: 2023 },
  { stock_no: '2222', roe: 10, gross_margin: 25, op_margin: 15, year: 2024 },
  { stock_no: '3333', roe: 12, gross_margin: 28, op_margin: 18, year: 2024 },
];
const fundRows = [
  { stock_no: '1111', foreign_net: 100, inv_trust_net: 50, date: '2024-02-01' },
  { stock_no: '1111', foreign_net: 90, inv_trust_net: 45, date: '2024-01-25' },
  { stock_no: '2222', foreign_net: 50, inv_trust_net: 20, date: '2024-02-01' },
  { stock_no: '3333', foreign_net: 80, inv_trust_net: 30, date: '2024-02-01' },
];
const priceRows = [
  { stock_no: '1111', close: 100, date: '2024-02-01' },
  { stock_no: '1111', close: 98, date: '2024-01-31' },
  { stock_no: '2222', close: 80, date: '2024-02-01' },
  { stock_no: '3333', close: 90, date: '2024-02-01' },
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
    const res = await calcScore('1111', { weights: { valuation: 80, growth: 10, quality: 5, chips: 3, momentum: 2 } });
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
    const res = await calcScore('1111', { weights: { valuation: 1 } });
    expect(res.total).toBeGreaterThan(0);
  });

  it('calculates score for additional stock code', async () => {
    const res = await calcScore('3333');
    expect(res.total).toBeGreaterThan(0);
    expect(res.missing).toEqual([]);
  });

  it('supports percentile method', async () => {
    const res = await calcScore('1111', { method: 'percentile' });
    expect(res.total).toBeGreaterThan(0);
  });

  it('supports rolling average', async () => {
    const res = await calcScore('1111', { method: 'rolling', window: 2 });
    expect(res.total).toBeGreaterThan(0);
  });
});
