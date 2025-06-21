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
  it('generates multiple windows', () => {
    const res = walkForward(ranks, prices, { start: '2020-01-01', rebalance: 30, top: 1, mode: 'equal', windowYears: 1, stepMonths: 3 });
    expect(res.length).toBeGreaterThan(3);
  });
});
