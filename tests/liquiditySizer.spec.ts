import { describe, it, expect } from 'vitest';
import { adjustForAdtv, Holding } from '../src/models/LiquiditySizer.js';

describe('adjustForAdtv', () => {
  it('sets weight to zero when ADTV is below threshold', () => {
    const holdings: Holding[] = [{ stockNo: 'A', weight: 1_000_000 }];
    const vols = { A: 0 };
    const res = adjustForAdtv(holdings, vols);
    expect(res.A).toBe(0);
  });

  it('caps weight at 10% of ADTV', () => {
    const holdings: Holding[] = [{ stockNo: 'B', weight: 20_000_000 }];
    const vols = { B: 100_000_000 };
    const res = adjustForAdtv(holdings, vols);
    expect(res.B).toBeCloseTo(10_000_000);
  });
});
