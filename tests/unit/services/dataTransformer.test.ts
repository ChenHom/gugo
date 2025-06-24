import { describe, it, expect } from 'vitest';
import { DataTransformer } from '../../../src/services/dataTransformer.js';

describe('DataTransformer', () => {
  describe('zScore', () => {
    it('should calculate z-score correctly', () => {
      const result = DataTransformer.zScore(10, 5, 2);
      expect(result).toBe(2.5);
    });

    it('should handle zero standard deviation', () => {
      const result = DataTransformer.zScore(10, 5, 0);
      expect(result).toBe(0);
    });
  });

  describe('percentile', () => {
    it('should calculate percentile correctly', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const p50 = DataTransformer.percentile(values, 50);
      const p90 = DataTransformer.percentile(values, 90);

      expect(p50).toBe(5.5);
      expect(p90).toBe(9.1);
    });

    it('should handle edge cases', () => {
      const values = [5];
      const p50 = DataTransformer.percentile(values, 50);

      expect(p50).toBe(5);
    });
  });

  describe('percentileRank', () => {
    it('should calculate percentile rank correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const rank = DataTransformer.percentileRank(3, values);

      expect(rank).toBe(50); // 3 is at 50th percentile
    });
  });

  describe('normalize', () => {
    it('should normalize values to 0-100 range', () => {
      const result = DataTransformer.normalize(5, 0, 10);
      expect(result).toBe(50);
    });

    it('should handle min equals max', () => {
      const result = DataTransformer.normalize(5, 5, 5);
      expect(result).toBe(50); // Should return base score
    });

    it('should clamp values to valid range', () => {
      const result1 = DataTransformer.normalize(-5, 0, 10);
      const result2 = DataTransformer.normalize(15, 0, 10);

      expect(result1).toBe(0);
      expect(result2).toBe(100);
    });
  });

  describe('calculateStats', () => {
    it('should calculate statistics correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = DataTransformer.calculateStats(values);

      expect(stats.mean).toBe(3);
      expect(stats.median).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.count).toBe(5);
      expect(stats.stdDev).toBeCloseTo(1.41, 1);
    });

    it('should handle empty array', () => {
      const stats = DataTransformer.calculateStats([]);

      expect(stats.mean).toBe(0);
      expect(stats.median).toBe(0);
      expect(stats.count).toBe(0);
    });

    it('should calculate median for even length arrays', () => {
      const values = [1, 2, 3, 4];
      const stats = DataTransformer.calculateStats(values);

      expect(stats.median).toBe(2.5);
    });
  });

  describe('calculateGrowthRate', () => {
    it('should calculate growth rate correctly', () => {
      const rate = DataTransformer.calculateGrowthRate(110, 100);
      expect(rate).toBe(10);
    });

    it('should handle negative growth', () => {
      const rate = DataTransformer.calculateGrowthRate(90, 100);
      expect(rate).toBe(-10);
    });

    it('should handle zero previous value', () => {
      const rate = DataTransformer.calculateGrowthRate(100, 0);
      expect(rate).toBeUndefined();
    });

    it('should handle undefined values', () => {
      const rate = DataTransformer.calculateGrowthRate(undefined as any, 100);
      expect(rate).toBeUndefined();
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate moving average correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const ma = DataTransformer.calculateMovingAverage(values, 3);

      expect(ma[0]).toBeNaN();
      expect(ma[1]).toBeNaN();
      expect(ma[2]).toBe(2); // (1+2+3)/3
      expect(ma[3]).toBe(3); // (2+3+4)/3
      expect(ma[4]).toBe(4); // (3+4+5)/3
    });
  });
});
