import { describe, it, expect } from 'vitest';
import { walkForward } from '../src/services/walkForward.js';
import { RankRow } from '../src/services/portfolioBuilder.js';

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
});
