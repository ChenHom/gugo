// 資料清理模組 - 處理缺失值與異常值
import { ValuationData, GrowthData } from '../types/index.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export class DataCleaner {

  static cleanValuationData(data: ValuationData[]): ValuationData[] {
    return data
      .filter(item => this.isValidStockCode(item.stockNo))
      .map(item => ({
        ...item,
        per: this.cleanNumericValue(item.per, { min: 0, max: 1000 }),
        pbr: this.cleanNumericValue(item.pbr, { min: 0, max: 100 }),
        dividendYield: this.cleanNumericValue(item.dividendYield, { min: 0, max: 50 }),
      }))
      .filter(item =>
        item.per !== undefined ||
        item.pbr !== undefined ||
        item.dividendYield !== undefined
      );
  }

  static cleanGrowthData(data: GrowthData[]): GrowthData[] {
    return data
      .filter(item => this.isValidStockCode(item.stockNo))
      .map(item => ({
        ...item,
        revenue: this.cleanNumericValue(item.revenue, { min: 0 }),
        yoy: this.cleanNumericValue(item.yoy, { min: -100, max: 1000 }),
        mom: this.cleanNumericValue(item.mom, { min: -100, max: 1000 }),
        eps: this.cleanNumericValue(item.eps, { min: -100, max: 1000 }),
        epsQoQ: this.cleanNumericValue(item.epsQoQ, { min: -1000, max: 1000 }),
      }))
      .filter(item =>
        item.revenue !== undefined ||
        item.yoy !== undefined ||
        item.mom !== undefined ||
        item.eps !== undefined
      );
  }

  private static isValidStockCode(stockNo: string): boolean {
    return /^\d{4}$/.test(stockNo);
  }

  private static cleanNumericValue(
    value: number | undefined,
    options: { min?: number; max?: number } = {}
  ): number | undefined {
    if (value === undefined || value === null || isNaN(value)) {
      return undefined;
    }

    // Remove extreme outliers
    if (options.min !== undefined && value < options.min) {
      return undefined;
    }

    if (options.max !== undefined && value > options.max) {
      return undefined;
    }

    return value;
  }

  static validateDataQuality<T extends { stockNo: string }>(
    data: T[],
    requiredFields: (keyof T)[]
  ): { valid: T[]; invalid: T[]; completenessRate: number } {
    const valid: T[] = [];
    const invalid: T[] = [];

    for (const item of data) {
      const hasRequiredFields = requiredFields.every(field => {
        const value = item[field];
        return value !== undefined && value !== null && value !== '';
      });

      if (hasRequiredFields) {
        valid.push(item);
      } else {
        invalid.push(item);
      }
    }

    const completenessRate = data.length > 0 ? valid.length / data.length : 0;

    return { valid, invalid, completenessRate };
  }

  static async logDataQuality(
    dataType: string,
    originalCount: number,
    cleanedCount: number,
    completenessRate: number
  ): Promise<void> {
    const message = `Data Quality Report - ${dataType}:
      Original records: ${originalCount}
      Cleaned records: ${cleanedCount}
      Data loss: ${originalCount - cleanedCount} (${((originalCount - cleanedCount) / originalCount * 100).toFixed(2)}%)
      Completeness rate: ${(completenessRate * 100).toFixed(2)}%`;

    console.log(message);

    if (completenessRate < 0.8) {
      const warning = new Error(`Low data quality detected for ${dataType}: ${(completenessRate * 100).toFixed(2)}% completeness`);
      await ErrorHandler.logError(warning, 'DataCleaner.logDataQuality');
    }
  }

  static removeOutliers(values: number[], method: 'iqr' | 'zscore' = 'iqr'): number[] {
    if (values.length === 0) return values;

    if (method === 'iqr') {
      return this.removeOutliersIQR(values);
    } else {
      return this.removeOutliersZScore(values);
    }
  }

  private static removeOutliersIQR(values: number[]): number[] {
    const sorted = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(sorted.length * 0.25);
    const q3Index = Math.floor(sorted.length * 0.75);

    const q1 = sorted[q1Index];
    const q3 = sorted[q3Index];

    if (q1 === undefined || q3 === undefined) return values;

    const iqr = q3 - q1;

    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return values.filter(value => value >= lowerBound && value <= upperBound);
  }

  private static removeOutliersZScore(values: number[], threshold: number = 3): number[] {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    );

    if (stdDev === 0) return values;

    return values.filter(value =>
      Math.abs((value - mean) / stdDev) <= threshold
    );
  }
}
