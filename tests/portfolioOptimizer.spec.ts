import { describe, it, expect } from 'vitest';
import { meanVarianceOptimize, riskParity } from '../src/analysis/portfolioOptimizer.js';

describe('portfolio optimizer', () => {
  it('mean variance weights sum to 1', () => {
    const w = meanVarianceOptimize([0.1, 0.2], [[0.1, 0], [0, 0.2]]);
    const sum = w.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it('risk parity produces weights', () => {
    const w = riskParity([[0.1, 0], [0, 0.4]]);
    expect(w.length).toBe(2);
  });
});
