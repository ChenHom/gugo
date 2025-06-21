import { describe, it, expect } from 'vitest';
import { buildPortfolios, RankRow } from '../src/services/portfolioBuilder.js';
import { backtest } from '../src/services/backtest.js';
import { CostModel } from '../src/models/CostModel.js';

describe('portfolioBuilder', () => {
  it('builds equal weights', () => {
    const ranks: RankRow[] = [
      { date: '2020-01-01', stock: 'A', score: 2 },
      { date: '2020-01-01', stock: 'B', score: 1 },
    ];
    const res = buildPortfolios(ranks, { top: 2, mode: 'equal' });
    expect(res['2020-01-01']!.A).toBeCloseTo(0.5);
    expect(res['2020-01-01']!.B).toBeCloseTo(0.5);
  });
});

describe('backtest engine', () => {
  const prices = { A: [{ date: '2020-01-01', close: 1 }, { date: '2020-01-02', close: 1 }] };
  const ranks: RankRow[] = [
    { date: '2020-01-01', stock: 'A', score: 1 },
  ];
  it('produces correct equity for single stock', () => {
    const cm = new CostModel(0, 0, 0);
    const res = backtest(ranks, prices, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal', costModel: cm });
    expect(res.equity[res.equity.length - 1]).toBeCloseTo(1, 6);
  });

  it('applies transaction costs', () => {
    const res = backtest(ranks, prices, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal' });
    expect(res.equity[res.equity.length - 1]).toBeLessThan(1);
  });

  it('sells on empty portfolio', () => {
    const r2: RankRow[] = [
      { date: '2020-01-01', stock: 'A', score: 1 },
      { date: '2020-01-02', stock: 'A', score: 0 },
    ];
    const res = backtest(r2, prices, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal', costModel: new CostModel(0,0,0) });
    expect(res.equity.length).toBe(2);
  });
});

describe('portfolioBuilder cap mode', () => {
  it('uses market cap weights', () => {
    const ranks: RankRow[] = [
      { date: '2020-01-01', stock: 'A', score: 2, marketCap: 200 },
      { date: '2020-01-01', stock: 'B', score: 1, marketCap: 100 },
    ];
    const res = buildPortfolios(ranks, { top: 2, mode: 'cap' });
    expect(res['2020-01-01']!.A).toBeCloseTo(2 / 3);
    expect(res['2020-01-01']!.B).toBeCloseTo(1 / 3);
  });
});

describe('cost model', () => {
  it('calculates buy and sell prices', () => {
    const cm = new CostModel(0.001, 0.002, 0.001);
    expect(cm.buy(100)).toBeCloseTo(100 * 1.001 * 1.001);
    expect(cm.sell(100)).toBeCloseTo(100 * 0.999 * (1 - 0.001 - 0.002));
  });
});
