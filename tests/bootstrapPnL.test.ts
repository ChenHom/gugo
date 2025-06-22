import { describe, it, expect } from 'vitest';
import { bootstrapPnL } from '../src/services/bootstrapPnL.js';
import { maxDrawdown } from '../src/analysis/performanceReport.js';

function seedRandom(seed: number): () => number {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('bootstrapPnL', () => {
  const equity = [1, 1.01, 0.99, 1.05, 1, 1.1, 1.2, 1.15, 1.25, 1.23, 1.3];
  it('observed drawdown is within 95% interval', () => {
    const rng = seedRandom(123);
    const { ci95_low, ci95_high } = bootstrapPnL(equity, 1000, rng);
    const mdd = maxDrawdown(equity);
    expect(mdd).toBeGreaterThanOrEqual(ci95_low);
    expect(mdd).toBeLessThanOrEqual(ci95_high);
  });

  it('throws on too short equity curve', () => {
    expect(() => bootstrapPnL([1], 10)).toThrow();
  });
});
