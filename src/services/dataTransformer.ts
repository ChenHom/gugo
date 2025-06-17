// 資料轉換模組 - 標準化和格式轉換
import { SCORING_CONFIG } from '../constants/index.js';

export class DataTransformer {

  // Z-score標準化
  static zScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  // 百分位數計算
  static percentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);

    if (index % 1 === 0) {
      return sorted[index] || 0;
    }

    const lower = sorted[Math.floor(index)] || 0;
    const upper = sorted[Math.ceil(index)] || 0;
    return lower + (upper - lower) * (index % 1);
  }

  // 計算百分位數排名
  static percentileRank(value: number, values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    let rank = 0;

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i]! < value) {
        rank = i + 1;
      } else if (sorted[i] === value) {
        rank = i + 0.5;
        break;
      } else {
        break;
      }
    }

    return (rank / sorted.length) * 100;
  }

  // 正規化到0-100區間
  static normalize(value: number, min: number, max: number): number {
    if (max === min) return SCORING_CONFIG.BASE_SCORE;

    const normalized = ((value - min) / (max - min)) * 100;
    return Math.max(SCORING_CONFIG.MIN_SCORE, Math.min(SCORING_CONFIG.MAX_SCORE, normalized));
  }

  // 計算統計摘要
  static calculateStats(values: number[]): {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    count: number;
  } {
    if (values.length === 0) {
      return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, count: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
      : sorted[Math.floor(sorted.length / 2)]!;

    return {
      mean,
      median,
      stdDev,
      min: sorted[0]!,
      max: sorted[sorted.length - 1]!,
      count: values.length,
    };
  }

  // 合併多期數據
  static aggregateTimeSeriesData<T extends { stockNo: string; date: string }>(
    data: T[],
    _aggregationType: 'latest' | 'average' | 'sum' = 'latest'
  ): Map<string, T[]> {
    // Group by stock
    const grouped = new Map<string, T[]>();

    for (const item of data) {
      if (!grouped.has(item.stockNo)) {
        grouped.set(item.stockNo, []);
      }
      grouped.get(item.stockNo)!.push(item);
    }

    // Sort each group by date (newest first)
    for (const [stockNo, items] of grouped) {
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      grouped.set(stockNo, items);
    }

    return grouped;
  }

  // 計算成長率 (QoQ, YoY)
  static calculateGrowthRate(current: number, previous: number): number | undefined {
    if (previous === 0 || previous === undefined || current === undefined) {
      return undefined;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  // 計算移動平均
  static calculateMovingAverage(values: number[], window: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < values.length; i++) {
      if (i < window - 1) {
        result.push(NaN);
      } else {
        const sum = values.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / window);
      }
    }

    return result;
  }

  // 數據透視表功能
  static pivot<T extends Record<string, any>>(
    data: T[],
    rowKey: keyof T,
    colKey: keyof T,
    valueKey: keyof T,
    aggregator: 'sum' | 'average' | 'count' | 'max' | 'min' = 'sum'
  ): Map<string, Map<string, number>> {
    const result = new Map<string, Map<string, number>>();

    for (const item of data) {
      const row = String(item[rowKey]);
      const col = String(item[colKey]);
      const value = Number(item[valueKey]) || 0;

      if (!result.has(row)) {
        result.set(row, new Map<string, number>());
      }

      const rowMap = result.get(row)!;

      if (!rowMap.has(col)) {
        rowMap.set(col, aggregator === 'count' ? 0 : value);
      }

      switch (aggregator) {
        case 'sum':
          rowMap.set(col, (rowMap.get(col) || 0) + value);
          break;
        case 'count':
          rowMap.set(col, (rowMap.get(col) || 0) + 1);
          break;
        case 'max':
          rowMap.set(col, Math.max(rowMap.get(col) || -Infinity, value));
          break;
        case 'min':
          rowMap.set(col, Math.min(rowMap.get(col) || Infinity, value));
          break;
        case 'average':
          // For average, we need to track sum and count separately
          // This is a simplified version
          rowMap.set(col, value);
          break;
      }
    }

    return result;
  }

  // 數據品質檢查
  static checkDataQuality<T extends Record<string, any>>(
    data: T[],
    requiredFields: (keyof T)[]
  ): {
    totalRecords: number;
    completeRecords: number;
    completenessRate: number;
    fieldCompleteness: Map<keyof T, number>;
  } {
    const totalRecords = data.length;
    let completeRecords = 0;
    const fieldCompleteness = new Map<keyof T, number>();

    // Initialize field completeness counters
    for (const field of requiredFields) {
      fieldCompleteness.set(field, 0);
    }

    for (const record of data) {
      let isComplete = true;

      for (const field of requiredFields) {
        const value = record[field];
        const hasValue = value !== null && value !== undefined && value !== '';

        if (hasValue) {
          fieldCompleteness.set(field, (fieldCompleteness.get(field) || 0) + 1);
        } else {
          isComplete = false;
        }
      }

      if (isComplete) {
        completeRecords++;
      }
    }

    // Calculate completion rates
    for (const [field, count] of fieldCompleteness) {
      fieldCompleteness.set(field, totalRecords > 0 ? count / totalRecords : 0);
    }

    return {
      totalRecords,
      completeRecords,
      completenessRate: totalRecords > 0 ? completeRecords / totalRecords : 0,
      fieldCompleteness,
    };
  }
}
