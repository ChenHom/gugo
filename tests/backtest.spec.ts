import { describe, it, expect } from 'vitest';
import { backtestMA } from '../src/backtest/maStrategy.js';
import { backtestMulti, TopNStrategy } from '../src/backtest/multiStrategy.js';

type Price = { date: string; close: number };

function genData(): Price[] {
  const res: Price[] = [];
  const start = new Date('2023-01-01');
  for (let i = 0; i < 60; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    res.push({ date: d.toISOString().split('T')[0]!, close: 10 });
  }
  for (let i = 60; i < 70; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    res.push({ date: d.toISOString().split('T')[0]!, close: 12 });
  }
  const d71 = new Date(start.getTime() + 70 * 86400000);
  res.push({ date: d71.toISOString().split('T')[0]!, close: 11 });
  const d72 = new Date(start.getTime() + 71 * 86400000);
  res.push({ date: d72.toISOString().split('T')[0]!, close: 7 });
  for (let i = 72; i < 120; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    res.push({ date: d.toISOString().split('T')[0]!, close: 7 });
  }
  return res;
}

describe('MA backtest', () => {
  it('executes trades based on rules', async () => {
    const prices = genData();
    const res = await backtestMA('TEST', { prices });
    expect(res.trades.length).toBe(2);
    expect(res.equityCurve[res.equityCurve.length - 1]).toBeLessThan(100);
  });
});

describe('multi-strategy backtest', () => {
  it('runs top-n strategy', () => {
    const series = genData();
    const prices = { AAA: series, BBB: series.map(p => ({ ...p, close: p.close * 1.1 })) };
    const scores = { AAA: series.map((_, i) => (i < 60 ? 1 : 2)), BBB: series.map(() => 3) };
    const strategy = new TopNStrategy(scores, 1);
    const res = backtestMulti(prices, strategy, { rebalance: 20 });
    expect(res.trades.length).toBeGreaterThan(0);
  });
});
