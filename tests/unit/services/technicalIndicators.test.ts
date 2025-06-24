import { describe, it, expect } from 'vitest';
import { PriceFetcher } from '../../../src/fetchers/priceFetcher.js';

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const ema = [prev];
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

describe('technical indicator calculations', () => {
  const fetcher = new PriceFetcher();
  const prices = Array.from({ length: 60 }, (_, i) => i + 1);

  it('calculates MA5 correctly', () => {
    const ma5 = (fetcher as any).calculateSMA(prices, 5) as number[];
    expect(ma5[ma5.length - 1]).toBe((56 + 57 + 58 + 59 + 60) / 5);
  });

  it('calculates MACD correctly', () => {
    const macd = (fetcher as any).calculateMACD(prices) as number[];
    const ema12 = calcEMA(prices, 12);
    const ema26 = calcEMA(prices, 26);
    const expected = ema26.map((val, i) => ema12[i + 14] - val);
    expect(macd[macd.length - 1]).toBeCloseTo(expected[expected.length - 1], 6);
  });

  it('calculates Bollinger Bands correctly', () => {
    const bands = (fetcher as any).calculateBollingerBands(prices, 20) as any;
    const slice = prices.slice(40);
    const mean = slice.reduce((a, b) => a + b, 0) / 20;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / 20;
    const std = Math.sqrt(variance);
    expect(bands.middle[bands.middle.length - 1]).toBeCloseTo(mean, 5);
    expect(bands.upper[bands.upper.length - 1]).toBeCloseTo(mean + 2 * std, 5);
    expect(bands.lower[bands.lower.length - 1]).toBeCloseTo(mean - 2 * std, 5);
  });
});
