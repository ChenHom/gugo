import { describe, it, expect } from 'vitest';
import { calcInformationCoefficient, calcFactorDecay, calcFactorCorrelation } from '../../../src/analysis/factorAnalysis.js';

describe('factor analysis', () => {
  it('calculates IC', () => {
    const data = [
      { date: '1', values: { A: 1, B: 2 }, returns: { A: 0.1, B: 0.2 } },
      { date: '2', values: { A: 2, B: 1 }, returns: { A: -0.1, B: -0.2 } },
    ];
    const ic = calcInformationCoefficient(data);
    expect(ic).toBeGreaterThan(0.9);
  });

  it('factor decay', () => {
    const vals = { A: [1, 2, 3], B: [3, 2, 1] };
    const decay = calcFactorDecay(vals, 1);
    expect(Object.keys(decay).length).toBe(2);
  });

  it('factor correlation', () => {
    const matrix = { A: [1, 2, 3], B: [1, 2, 4] };
    const corr = calcFactorCorrelation(matrix);
    expect(corr.A.B).toBeGreaterThan(0.9);
  });
});
