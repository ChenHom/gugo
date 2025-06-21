import { BacktestMetrics, Trade } from './maStrategy.js';
import { calcMetrics } from './utils.js';

export type Price = { date: string; close: number };
export type PriceMap = Record<string, Price[]>;

export interface Strategy {
  selectStocks(dateIndex: number, prices: PriceMap): string[];
}

export class TopNStrategy implements Strategy {
  constructor(private scores: Record<string, number[]>, private n: number) {}
  selectStocks(i: number, _p: PriceMap): string[] {
    const entries = Object.entries(this.scores).map(([s, arr]) => ({ s, v: arr[i] ?? -Infinity }));
    return entries
      .sort((a, b) => b.v - a.v)
      .slice(0, this.n)
      .map(e => e.s);
  }
}

export class ThresholdStrategy implements Strategy {
  constructor(private scores: Record<string, number[]>, private threshold: number) {}
  selectStocks(i: number, _p: PriceMap): string[] {
    return Object.entries(this.scores)
      .filter(([, arr]) => (arr[i] ?? -Infinity) >= this.threshold)
      .map(([s]) => s);
  }
}

export class SectorRotationStrategy implements Strategy {
  constructor(
    private sectorMap: Record<string, string>,
    private momentum: Record<string, number[]>,
    private n: number
  ) {}
  selectStocks(i: number, _prices: PriceMap): string[] {
    const sectors = new Map<string, { sec: string; mo: number }>();
    for (const [stock, arr] of Object.entries(this.momentum)) {
      const sec = this.sectorMap[stock];
      if (!sec) continue;
      const mo = arr[i] ?? -Infinity;
      const item = sectors.get(sec);
      if (!item || item.mo < mo) sectors.set(sec, { sec, mo });
    }
    return Array.from(sectors.values())
      .sort((a, b) => b.mo - a.mo)
      .slice(0, this.n)
      .flatMap(v => Object.entries(this.sectorMap).filter(([, s]) => s === v.sec).map(([k]) => k));
  }
}

export interface BacktestOptions {
  rebalance: number; // in days
  startDate?: string;
  endDate?: string;
}

export function backtestMulti(prices: PriceMap, strategy: Strategy, opts: BacktestOptions): BacktestMetrics {
  const allDates = Array.from(new Set(Object.values(prices).flat().map(p => p.date))).sort();

  let cash = 100;
  const shares: Record<string, number> = {};
  const equity: number[] = [];
  const trades: Trade[] = [];
  const FEE = 0.001425;
  for (let i = 0; i < allDates.length; i++) {
    const date = allDates[i]!;
    for (const [s, series] of Object.entries(prices)) {
      const price = series.find(p => p.date === date)?.close;
      if (price && shares[s]) {
        equity[i] = (equity[i] ?? 0) + shares[s]! * price;
      }
    }
    equity[i] = (equity[i] ?? 0) + cash;
    if (i % opts.rebalance === 0) {
      const targets = strategy.selectStocks(i, prices);
      const current = Object.keys(shares);
      for (const s of current) {
        if (!targets.includes(s)) {
          const price = prices[s]!.find(p => p.date === date)?.close;
          if (price) {
            cash += shares[s]! * price * (1 - FEE);
            trades.push({ date, price, action: 'sell' });
            delete shares[s];
          }
        }
      }
      const equalCash = cash / targets.length;
      for (const s of targets) {
        const price = prices[s]!.find(p => p.date === date)?.close;
        if (price) {
          const qty = equalCash / (price * (1 + FEE));
          cash -= qty * price * (1 + FEE);
          shares[s] = (shares[s] ?? 0) + qty;
          trades.push({ date, price, action: 'buy' });
        }
      }
    }
  }
  const metrics = calcMetrics(equity);
  return { ...metrics, equityCurve: equity, trades };
}
