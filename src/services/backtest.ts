import { CostModel } from '../models/CostModel.js';
import { buildPortfolios, RankRow, PortfolioOptions, WeightMap } from './portfolioBuilder.js';
import { annualizeReturn, calcReturns, calcSharpe, maxDrawdown } from '../analysis/performanceReport.js';

export interface PriceBar { date: string; close: number }
export type PriceSeries = Record<string, PriceBar[]>;

export interface BacktestOptions extends PortfolioOptions {
  start: string;
  end?: string;
  rebalance: number;
  costModel?: CostModel;
}

export interface BacktestResult {
  equity: number[];
  dates: string[];
  cagr: number;
  sharpe: number;
  mdd: number;
}

function getPriceLookup(prices: PriceSeries): Record<string, Map<string, number>> {
  const lookup: Record<string, Map<string, number>> = {};
  for (const [s, series] of Object.entries(prices)) {
    const map = new Map<string, number>();
    for (const p of series) {
      if (!Number.isFinite(p.close) || p.close <= 0) {
        throw new Error(`Invalid price for ${s} on ${p.date}`);
      }
      map.set(p.date, p.close);
    }
    lookup[s] = map;
  }
  return lookup;
}

function forwardPrice(map: Map<string, number>, date: string, last: number | null): number | null {
  const price = map.get(date);
  if (price != null) return price;
  return last;
}

export function backtest(
  ranks: RankRow[],
  prices: PriceSeries,
  opts: BacktestOptions
): BacktestResult {
  const weights = buildPortfolios(
    ranks.filter(r => r.date >= opts.start && (!opts.end || r.date <= opts.end)),
    opts
  );
  const allDates = Array.from(
    new Set(Object.values(prices).flatMap(p => p.map(r => r.date)))
  ).sort();
  const dates = allDates.filter(
    d => d >= opts.start && (!opts.end || d <= opts.end)
  );
  if (dates.length === 0) {
    throw new Error('No price data in specified range');
  }

  const priceLookup = getPriceLookup(prices);
  const holdings: Record<string, number> = {};
  const model = opts.costModel ?? new CostModel();
  let cash = 1;
  const equity: number[] = [];
  const lastPrice: Record<string, number | null> = {};

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i]!;
    for (const s of Object.keys(priceLookup)) {
      const price = forwardPrice(priceLookup[s]!, date, lastPrice[s] ?? null);
      if (price != null) lastPrice[s] = price;
    }

    const port = weights[date];
    if (port && (i === 0 || i % opts.rebalance === 0)) {
      const value = cash + Object.entries(holdings).reduce((sum, [s, q]) => sum + (lastPrice[s]! ?? 0) * q, 0);
      for (const [s, qty] of Object.entries(holdings)) {
        if (!port[s]) {
          const price = lastPrice[s];
          if (price != null) {
            cash += model.apply(price, 'sell') * qty;
            delete holdings[s];
          }
        }
      }
      for (const [s, weight] of Object.entries(port)) {
        const price = lastPrice[s];
        if (price == null) continue;
        const target = (value * weight) / price;
        const cur = holdings[s] ?? 0;
        const diff = target - cur;
        if (Math.abs(diff) < 1e-8) continue;
        if (diff > 0) {
          const cost = model.apply(price, 'buy') * diff;
          cash -= cost;
          holdings[s] = cur + diff;
        } else {
          const qty = -diff;
          cash += model.apply(price, 'sell') * qty;
          holdings[s] = cur - qty;
        }
      }
    }

    const val = cash + Object.entries(holdings).reduce((sum, [s, q]) => sum + (lastPrice[s]! ?? 0) * q, 0);
    equity.push(val);
  }

  const returns = calcReturns(equity);
  const cagr = annualizeReturn(returns);
  const sharpe = calcSharpe(returns);
  const mdd = maxDrawdown(equity);
  return { equity, dates, cagr, sharpe, mdd };
}
