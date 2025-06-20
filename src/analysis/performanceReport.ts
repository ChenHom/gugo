import { pearsonCorrelation } from './factorAnalysis.js';

export function calcReturns(prices: number[]): number[] {
  const res: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    res.push(prices[i]! / prices[i - 1]! - 1);
  }
  return res;
}

export function annualizeReturn(returns: number[]): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  return Math.pow(1 + mean, 252) - 1;
}

export function calcVolatility(returns: number[]): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function calcSharpe(returns: number[], rf = 0): number {
  const excess = returns.map(r => r - rf / 252);
  return annualizeReturn(excess) / calcVolatility(excess);
}

export function maxDrawdown(equity: number[]): number {
  let peak = equity[0]!;
  let max = 0;
  for (const val of equity) {
    if (val > peak) peak = val;
    const draw = 1 - val / peak;
    if (draw > max) max = draw;
  }
  return -max;
}

export function attribution(weights: number[][], returns: number[][]): number[] {
  const periods = returns[0]!.length;
  const n = weights.length;
  const contrib = new Array(n).fill(0);
  for (let t = 0; t < periods; t++) {
    for (let i = 0; i < n; i++) {
      contrib[i] += weights[i]![t]! * returns[i]![t]!;
    }
  }
  return contrib;
}

export function beta(asset: number[], benchmark: number[]): number {
  const rA = calcReturns(asset);
  const rB = calcReturns(benchmark);
  return pearsonCorrelation(rA, rB) * (calcVolatility(rA) / calcVolatility(rB));
}
