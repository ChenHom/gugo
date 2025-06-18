import { FinMindClient } from '../utils/finmindClient.js';

export interface Trade {
  date: string;
  price: number;
  action: 'buy' | 'sell';
}

export interface BacktestMetrics {
  annualReturn: number;
  sharpe: number;
  maxDrawdown: number;
  equityCurve: number[];
  trades: Trade[];
}

export interface BacktestOptions {
  startDate?: string;
  endDate?: string;
  prices?: Array<{ date: string; close: number }>;
}

const FEE_RATE = 0.001425; // 0.1425%
const SLIPPAGE = 0.0005; // 0.05%

function sma(values: number[], period: number, index: number): number {
  const slice = values.slice(index - period + 1, index + 1);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calcMetrics(equity: number[]): { annualReturn: number; sharpe: number; maxDrawdown: number } {
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push(equity[i]! / equity[i - 1]! - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  const annualReturn = Math.pow(1 + mean, 252) - 1;
  const sharpe = std === 0 ? 0 : (mean / std) * Math.sqrt(252);

  let peak = equity[0]!;
  let maxDrawdown = 0;
  for (const val of equity) {
    if (val > peak) peak = val;
    const draw = val / peak - 1;
    if (draw < maxDrawdown) maxDrawdown = draw;
  }
  return { annualReturn, sharpe, maxDrawdown };
}

export async function backtestMA(stock: string, opts: BacktestOptions = {}): Promise<BacktestMetrics> {
  const start = opts.startDate || '2023-01-01';
  const end = opts.endDate || '2025-06-11';
  let prices = opts.prices;

  if (!prices) {
    const client = new FinMindClient();
    const raw = await client.getStockPrice(stock, start, end);
    prices = raw.map(r => ({ date: r.date, close: r.close }));
  }

  prices.sort((a, b) => a.date.localeCompare(b.date));
  const closes = prices.map(p => p.close);
  let cash = 100;
  let shares = 0;
  let entry = 0;
  const equity: number[] = [];
  const trades: Trade[] = [];

  for (let i = 0; i < prices.length; i++) {
    const close = prices[i]!.close;
    if (shares > 0) {
      equity.push(shares * close);
    } else {
      equity.push(cash);
    }

    if (i < 60) continue;

    const ma20 = sma(closes, 20, i);
    const ma60 = sma(closes, 60, i);
    const ma20Prev = sma(closes, 20, i - 1);
    const ma60Prev = sma(closes, 60, i - 1);

    if (shares === 0) {
      if (ma20 > ma60 && ma20Prev <= ma60Prev) {
        const buyPrice = close * (1 + SLIPPAGE);
        shares = cash / (buyPrice * (1 + FEE_RATE));
        cash = 0;
        entry = close;
        trades.push({ date: prices[i]!.date, price: close, action: 'buy' });
      }
    } else {
      const stop = entry * 0.92;
      if (close < stop || close < ma60) {
        const sellPrice = close * (1 - SLIPPAGE);
        cash = shares * sellPrice * (1 - FEE_RATE);
        shares = 0;
        trades.push({ date: prices[i]!.date, price: close, action: 'sell' });
      }
    }
  }

  if (shares > 0) {
    const last = prices[prices.length - 1]!;
    const sellPrice = last.close * (1 - SLIPPAGE);
    cash = shares * sellPrice * (1 - FEE_RATE);
    shares = 0;
    trades.push({ date: last.date, price: last.close, action: 'sell' });
    equity[equity.length - 1] = cash;
  } else {
    equity[equity.length - 1] = cash;
  }

  const metrics = calcMetrics(equity);
  return { ...metrics, equityCurve: equity, trades };
}
