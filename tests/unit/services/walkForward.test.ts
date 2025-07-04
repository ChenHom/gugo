import { describe, it, expect } from 'vitest';
import { walkForward } from '../../../src/services/walkForward.js';
import { RankRow } from '../../../src/services/portfolioBuilder.js';

const prices = {
  A: Array.from({ length: 365 * 4 }, (_, i) => ({
    date: new Date(2020, 0, 1 + i).toISOString().slice(0, 10),
    close: 1,
  })),
};

const ranks: RankRow[] = prices.A.map(p => ({ date: p.date, stock: 'A', score: 1 }));

describe('walkForward', () => {
  it('calculates expected number of windows', () => {
    const res = walkForward(ranks, prices, {
      start: '2020-01-01',
      end: '2022-12-31',
      rebalance: 30,
      top: 1,
      mode: 'equal',
      windowYears: 1,
      stepMonths: 6,
    });
    const addMonths = (d: string, m: number): string => {
      const dt = new Date(d);
      dt.setMonth(dt.getMonth() + m);
      return dt.toISOString().slice(0, 10);
    };
    let count = 0;
    let cur = '2020-01-01';
    while (addMonths(cur, 12) <= '2022-12-31') {
      count++;
      cur = addMonths(cur, 6);
    }
    expect(res.length).toBe(count);
  });

  it('row count matches floor((total-window)/step)+1', () => {
    const start = '2020-01-01';
    const step = 3;
    const windowMonths = 12;
    const res = walkForward(ranks, prices, { start, rebalance: 30, top: 1, mode: 'equal', windowYears: 1, stepMonths: step });
    const last = prices.A[prices.A.length - 1]!.date;
    const months = (d1: string, d2: string) => {
      const a = new Date(d1);
      const b = new Date(d2);
      return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
    };
    const total = months(start, last);
    const expected = Math.floor((total - windowMonths) / step) + 1;
    expect(res.length).toBe(expected);
  });
});
