import { RankRow } from './portfolioBuilder.js';
import { backtest, PriceSeries, BacktestOptions } from './backtest.js';

export interface WalkForwardOptions extends Omit<BacktestOptions, 'start'> {
  start: string;
  windowYears: number;
  stepMonths: number;
}

export interface WalkForwardResult {
  start: string;
  end: string;
  cagr: number;
  sharpe: number;
  mdd: number;
}

function addMonths(date: string, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function walkForward(
  ranks: RankRow[],
  prices: PriceSeries,
  opts: WalkForwardOptions
): WalkForwardResult[] {
  const dates = Array.from(
    new Set(ranks.map(r => r.date).concat(...Object.values(prices).flatMap(p => p.map(x => x.date))))
  ).sort();
  if (dates.length === 0) return [];
  const results: WalkForwardResult[] = [];
  let winStart = opts.start;
  const winSizeMonths = opts.windowYears * 12;
  while (true) {
    const winEnd = addMonths(winStart, winSizeMonths);
    if (winEnd > dates[dates.length - 1]!) break;
    const res = backtest(
      ranks.filter(r => r.date >= winStart && r.date <= winEnd),
      Object.fromEntries(
        Object.entries(prices).map(([s, arr]) => [s, arr.filter(p => p.date >= winStart && p.date <= winEnd)])
      ),
      { ...opts, start: winStart }
    );
    results.push({ start: winStart, end: winEnd, cagr: res.cagr, sharpe: res.sharpe, mdd: res.mdd });
    winStart = addMonths(winStart, opts.stepMonths);
  }
  return results;
}
