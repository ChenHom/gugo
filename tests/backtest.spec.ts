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

  it('selects exactly N holdings per date and sums to 1', () => {
    const ranks: RankRow[] = [
      { date: '2020-01-01', stock: 'A', score: 3 },
      { date: '2020-01-01', stock: 'B', score: 2 },
      { date: '2020-01-01', stock: 'C', score: 1 },
      { date: '2020-01-02', stock: 'A', score: 3 },
      { date: '2020-01-02', stock: 'B', score: 2 },
      { date: '2020-01-02', stock: 'C', score: 1 },
    ];
    const res = buildPortfolios(ranks, { top: 2, mode: 'equal' });
    for (const d of ['2020-01-01', '2020-01-02']) {
      const w = res[d]!;
      expect(Object.keys(w).length).toBe(2);
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 12);
    }
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

  it('matches single stock equity including transaction costs', () => {
    const res = backtest(ranks, prices, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal' });
    expect(res.equity.pop()!).toBeCloseTo(0.9970728625, 6);
  });

  it('removing a day never increases drawdown', () => {
    const price2 = { A: [
      { date: '2020-01-01', close: 1 },
      { date: '2020-01-02', close: 1.2 },
      { date: '2020-01-03', close: 0.8 },
      { date: '2020-01-04', close: 1 },
    ] };
    const ranks2: RankRow[] = price2.A.map(p => ({ date: p.date, stock: 'A', score: 1 }));
    const full = backtest(ranks2, price2, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal', costModel: new CostModel(0,0,0) });
    const removed = backtest(ranks2.slice(1), { A: price2.A.slice(1) }, { start: '2020-01-02', rebalance: 1, top: 1, mode: 'equal', costModel: new CostModel(0,0,0) });
    expect(removed.mdd).toBeGreaterThanOrEqual(full.mdd);
  });

  it('sells on empty portfolio', () => {
    const r2: RankRow[] = [
      { date: '2020-01-01', stock: 'A', score: 1 },
      { date: '2020-01-02', stock: 'A', score: 0 },
    ];
    const res = backtest(r2, prices, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal', costModel: new CostModel(0,0,0) });
    expect(res.equity.length).toBe(2);
  });

  it('respects end date', () => {
    const res = backtest(ranks, prices, { start: '2020-01-01', end: '2020-01-01', rebalance: 1, top: 1, mode: 'equal', costModel: new CostModel(0,0,0) });
    expect(res.dates.length).toBe(1);
  });

  it('throws on invalid price data', () => {
    const bad = { A: [{ date: '2020-01-01', close: NaN }] } as any;
    expect(() => backtest(ranks, bad, { start: '2020-01-01', rebalance: 1, top: 1, mode: 'equal' })).toThrow();
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
  it('calculates buy and sell prices via apply()', () => {
    const cm = new CostModel(0.001, 0.002, 0.001);
    expect(cm.apply(100, 'buy')).toBeCloseTo(100 * 1.001 * 1.001);
    expect(cm.apply(100, 'sell')).toBeCloseTo(100 * 0.999 * (1 - 0.001 - 0.002));
  });

  it('buy() and sell() delegate to apply()', () => {
    const cm = new CostModel();
    expect(cm.buy(50)).toBeCloseTo(cm.apply(50, 'buy'));
    expect(cm.sell(50)).toBeCloseTo(cm.apply(50, 'sell'));
  });

  it('rate changes alter the output', () => {
    const cm = new CostModel();
    const baseBuy = cm.apply(100, 'buy');
    cm.brokerage = 0.002;
    expect(cm.apply(100, 'buy')).not.toBeCloseTo(baseBuy);
  });
});
