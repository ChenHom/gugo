import { describe, it, expect } from 'vitest';
import { DataCleaner } from '../src/services/dataCleaner.js';
import { ValuationData, GrowthData } from '../src/types/index.js';

describe('DataCleaner', () => {
  describe('cleanValuationData', () => {
    it('should filter out invalid stock codes', () => {
      const testData: ValuationData[] = [
        { stockNo: '2330', date: '2025-06-17', per: 15.5, pbr: 2.1, dividendYield: 3.2 },
        { stockNo: 'INVALID', date: '2025-06-17', per: 20.0, pbr: 1.8, dividendYield: 2.5 },
        { stockNo: '123', date: '2025-06-17', per: 12.0, pbr: 1.5, dividendYield: 4.0 },
      ];

      const cleaned = DataCleaner.cleanValuationData(testData);

      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]?.stockNo).toBe('2330');
    });

    it('should remove extreme outliers', () => {
      const testData: ValuationData[] = [
        { stockNo: '2330', date: '2025-06-17', per: 15.5, pbr: 2.1, dividendYield: 3.2 },
        { stockNo: '2454', date: '2025-06-17', per: 2000, pbr: 200, dividendYield: 100 }, // Extreme outliers
      ];

      const cleaned = DataCleaner.cleanValuationData(testData);

      expect(cleaned).toHaveLength(1);
      expect(cleaned[0]?.stockNo).toBe('2330');
    });

    it('should handle undefined values gracefully', () => {
      const testData: ValuationData[] = [
        { stockNo: '2330', date: '2025-06-17', per: undefined, pbr: 2.1, dividendYield: 3.2 },
        { stockNo: '2454', date: '2025-06-17', per: 15.5, pbr: undefined, dividendYield: undefined },
      ];

      const cleaned = DataCleaner.cleanValuationData(testData);

      expect(cleaned).toHaveLength(2);
      expect(cleaned[0]?.per).toBeUndefined();
      expect(cleaned[0]?.pbr).toBe(2.1);
    });
  });

  describe('validateDataQuality', () => {
    it('should calculate completeness rate correctly', () => {
      const testData = [
        { stockNo: '2330', value1: 10, value2: 20 },
        { stockNo: '2454', value1: 15, value2: undefined },
        { stockNo: '2891', value1: undefined, value2: 30 },
      ];

      const result = DataCleaner.validateDataQuality(testData, ['value1', 'value2']);

      expect(result.completenessRate).toBe(1/3); // Only first record has both values
      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(2);
    });
  });

  describe('removeOutliers', () => {
    it('should remove outliers using IQR method', () => {
      const values = [1, 2, 3, 4, 5, 100]; // 100 is an outlier
      const cleaned = DataCleaner.removeOutliers(values, 'iqr');

      expect(cleaned).not.toContain(100);
      expect(cleaned).toContain(1);
      expect(cleaned).toContain(5);
    });

    it('should handle empty arrays', () => {
      const values: number[] = [];
      const cleaned = DataCleaner.removeOutliers(values);

      expect(cleaned).toEqual([]);
    });
  });
});
