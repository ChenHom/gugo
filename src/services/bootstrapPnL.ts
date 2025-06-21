import { calcReturns, maxDrawdown } from '../analysis/performanceReport.js';

export interface BootstrapResult {
  ci95_low: number;
  ci95_high: number;
}

export function bootstrapPnL(
  equity: number[],
  iterations = 1000,
  rng: () => number = Math.random
): BootstrapResult {
  if (equity.length < 2) {
    throw new Error('Equity curve too short');
  }

  const returns = calcReturns(equity);
  const mdds: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const sampled: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      const idx = Math.floor(rng() * returns.length);
      sampled.push(returns[idx]!);
    }
    let cur = 1;
    const path: number[] = [cur];
    for (const r of sampled) {
      cur *= 1 + r;
      path.push(cur);
    }
    mdds.push(maxDrawdown(path));
  }

  const sorted = mdds.slice().sort((a, b) => a - b);
  const lowIdx = Math.floor(iterations * 0.025);
  const highIdx = Math.floor(iterations * 0.975);
  return {
    ci95_low: sorted[lowIdx]!,
    ci95_high: sorted[Math.min(highIdx, sorted.length - 1)]!,
  };
}
