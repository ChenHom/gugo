import { DatabaseManager } from '../utils/databaseManager.js';
import { CacheManager } from '../utils/cacheManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { ScoringEngine } from './scoringEngine.js';

export interface UpdateOptions {
  force?: boolean; // 強制更新，忽略快取
  factors?: string[]; // 指定要更新的因子
  stocks?: string[]; // 指定要更新的股票
}

export interface UpdateResult {
  factor: string;
  success: boolean;
  recordsUpdated: number;
  error?: string;
  timestamp: Date;
}

export class DataUpdater {
  private dbManager: DatabaseManager;
  private cacheManager: CacheManager;
  private scoringEngine: ScoringEngine;

  constructor() {
    this.dbManager = new DatabaseManager();
    this.cacheManager = new CacheManager();
    this.scoringEngine = new ScoringEngine();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.dbManager.initialize(),
      this.scoringEngine.initialize()
    ]);
  }

  async updateAllData(options: UpdateOptions = {}): Promise<UpdateResult[]> {
    const results: UpdateResult[] = [];
    const factors = options.factors || ['valuation', 'growth', 'quality', 'fund-flow', 'momentum'];

    console.log('🔄 開始資料更新...');

    for (const factor of factors) {
      console.log(`📊 更新 ${factor} 因子資料...`);
      const result = await this.updateFactorData(factor, options);
      results.push(result);

      if (result.success) {
        console.log(`✅ ${factor}: ${result.recordsUpdated} 筆記錄已更新`);
      } else {
        console.error(`❌ ${factor}: ${result.error}`);
      }
    }

    // 重新計算所有評分
    console.log('🧮 重新計算評分...');
    try {
      await this.scoringEngine.calculateStockScores();
      console.log('✅ 評分計算完成');
    } catch (error) {
      console.error('❌ 評分計算失敗:', error);
    }

    return results;
  }

  private async updateFactorData(factor: string, options: UpdateOptions): Promise<UpdateResult> {
    const result: UpdateResult = {
      factor,
      success: false,
      recordsUpdated: 0,
      timestamp: new Date()
    };

    try {
      let recordsUpdated = 0;

      switch (factor) {
        case 'valuation':
          recordsUpdated = await this.updateValuationData(options);
          break;
        case 'growth':
          recordsUpdated = await this.updateGrowthData(options);
          break;
        case 'quality':
          recordsUpdated = await this.updateQualityData(options);
          break;
        case 'fund-flow':
          recordsUpdated = await this.updateFundFlowData(options);
          break;
        case 'momentum':
          recordsUpdated = await this.updateMomentumData(options);
          break;
        default:
          throw new Error(`不支援的因子: ${factor}`);
      }

      result.success = true;
      result.recordsUpdated = recordsUpdated;
    } catch (error) {
      result.error = (error as Error).message;
      await ErrorHandler.logError(error as Error, `DataUpdater.updateFactorData.${factor}`);
    }

    return result;
  }

  private async updateValuationData(options: UpdateOptions): Promise<number> {
    const fetcher = new ValuationFetcher();
    await fetcher.initialize();

    try {
      const response = await fetcher.fetchValuationData({
        useCache: !options.force,
        stockNos: options.stocks
      });

      return response.data?.length || 0;
    } finally {
      await fetcher.close();
    }
  }

  private async updateGrowthData(options: UpdateOptions): Promise<number> {
    const fetcher = new GrowthFetcher();
    await fetcher.initialize();

    try {
      let totalRecords = 0;

      // 更新營收資料
      const stockList = options.stocks || ['2330', '2317', '2454'];
      const revenueResponse = await fetcher.fetchRevenueData({
        useCache: !options.force,
        stockNos: stockList
      });
      totalRecords += revenueResponse.data?.length || 0;

      // 更新EPS資料
      const epsResponse = await fetcher.fetchEpsData({
        useCache: !options.force,
        stockNos: stockList
      });
      totalRecords += epsResponse.data?.length || 0;

      return totalRecords;
    } finally {
      await fetcher.close();
    }
  }

  private async updateQualityData(_options: UpdateOptions): Promise<number> {
    const fetcher = new QualityFetcher();

    const data = await fetcher.fetchQualityData();
    return data.length;
  }

  private async updateFundFlowData(options: UpdateOptions): Promise<number> {
    const fetcher = new FundFlowFetcher();
    await fetcher.initialize();

    try {
      const stockList = options.stocks || ['2330', '2317', '2454'];
      const result = await fetcher.fetchFundFlowData({
        stockNos: stockList,
        useCache: !options.force
      });

      return result.data?.length || 0;
    } finally {
      await fetcher.close();
    }
  }

  private async updateMomentumData(options: UpdateOptions): Promise<number> {
    const fetcher = new MomentumFetcher();
    try {
      const stocks = options.stocks || ['2330'];
      const data = await fetcher.fetchMomentumData(stocks);
      return data.length;
    } finally {
      await fetcher.close();
    }
  }

  async getLastUpdateTime(): Promise<Record<string, Date | null>> {
    try {
      const db = this.dbManager.getDatabase();

      const tables = [
        { name: 'valuation', factor: 'valuation' },
        { name: 'growth', factor: 'growth' },
        { name: 'quality_data', factor: 'quality' },
        { name: 'fund_flow', factor: 'fund-flow' },
        { name: 'momentum', factor: 'momentum' },
        { name: 'stock_scores', factor: 'scores' }
      ];

      const lastUpdateTimes: Record<string, Date | null> = {};

      for (const table of tables) {
        try {
          const result = db.prepare(`
            SELECT MAX(
              CASE
                WHEN ${table.name} = 'stock_scores' THEN updated_at
                WHEN ${table.name} = 'quality_data' THEN fetched_at
                ELSE date
              END
            ) as last_update
            FROM ${table.name}
          `).get() as { last_update: string | null };

          lastUpdateTimes[table.factor] = result.last_update
            ? new Date(result.last_update)
            : null;
        } catch (error) {
          // 表格可能不存在
          lastUpdateTimes[table.factor] = null;
        }
      }

      return lastUpdateTimes;
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'DataUpdater.getLastUpdateTime');
      return {};
    }
  }

  async cleanOldData(daysToKeep: number = 90): Promise<number> {
    try {
      const db = this.dbManager.getDatabase();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffString = cutoffDate.toISOString().slice(0, 10);

      let totalDeleted = 0;

      // 清理舊的估值資料
      const valuationDeleted = db.prepare(`
        DELETE FROM valuation WHERE date < ?
      `).run(cutoffString);
      totalDeleted += valuationDeleted.changes;

      // 清理舊的成長資料
      const growthDeleted = db.prepare(`
        DELETE FROM growth WHERE month < ?
      `).run(cutoffString.slice(0, 7)); // YYYY-MM格式
      totalDeleted += growthDeleted.changes;

      console.log(`🗑️ 清理了 ${totalDeleted} 筆超過 ${daysToKeep} 天的舊資料`);
      return totalDeleted;
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'DataUpdater.cleanOldData');
      throw error;
    }
  }

  async close(): Promise<void> {
    await Promise.all([
      this.dbManager.close(),
      this.scoringEngine.close()
    ]);
  }
}
