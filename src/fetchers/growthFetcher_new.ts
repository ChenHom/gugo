import { FinMindClient, MonthlyRevenueData } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface GrowthMetrics {
  stock_id: string;
  month: string;
  revenue?: number;
  yoy?: number;
  mom?: number;
  eps?: number;
  eps_qoq?: number;
}

/**
 * 成長指標資料擷取器
 * 負責抓取和處理營收成長、EPS 成長等指標
 */
export class GrowthFetcher {
  private client: FinMindClient;
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(finmindToken?: string, dbPath: string = 'data/fundamentals.db') {
    this.client = new FinMindClient(finmindToken);
    this.dbPath = dbPath;
    this.getDb();
  }

  private getDb(): Database.Database {
    if (!this.db) {
      // 確保資料夾存在
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      this.initializeDatabase();
    }
    return this.db;
  }

  private initializeDatabase(): void {
    const db = this.getDb();

    // 創建成長指標表
    db.exec(`
      CREATE TABLE IF NOT EXISTS growth_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        month TEXT NOT NULL,
        revenue INTEGER,
        yoy REAL,
        mom REAL,
        eps REAL,
        eps_qoq REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, month)
      )
    `);

    console.log('成長指標資料庫初始化完成');
  }

  /**
   * 抓取月營收成長資料
   */
  async fetchRevenueGrowth(
    stockId: string,
    startDate: string,
    endDate: string
  ): Promise<GrowthMetrics[]> {
    console.log(`📈 抓取營收成長資料: ${stockId} (${startDate} ~ ${endDate})`);

    try {
      // 抓取月營收資料
      const revenueData = await this.client.getMonthlyRevenue(stockId, startDate, endDate);

      if (!revenueData || revenueData.length === 0) {
        console.log(`⚠️  ${stockId} 無營收資料`);
        return [];
      }

      // 計算成長率
      const growthMetrics = this.calculateGrowthRates(revenueData);

      // 儲存到資料庫
      await this.saveGrowthMetrics(growthMetrics);

      console.log(`✅ 成功計算 ${growthMetrics.length} 期營收成長資料`);
      return growthMetrics;

    } catch (error) {
      console.error(`❌ 抓取 ${stockId} 營收成長資料失敗:`, error);
      throw error;
    }
  }

  /**
   * 計算營收成長率
   */
  private calculateGrowthRates(revenueData: MonthlyRevenueData[]): GrowthMetrics[] {
    const sortedData = revenueData.sort((a, b) => a.date.localeCompare(b.date));
    const metrics: GrowthMetrics[] = [];

    for (let i = 0; i < sortedData.length; i++) {
      const current = sortedData[i];
      const yearAgo = sortedData.find(item => {
        const currentDate = new Date(current.date);
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === currentDate.getFullYear() - 1 &&
               itemDate.getMonth() === currentDate.getMonth();
      });

      const monthAgo = i > 0 ? sortedData[i - 1] : null;

      const metric: GrowthMetrics = {
        stock_id: current.stock_id,
        month: current.date.substring(0, 7) + '-01', // 轉換為 YYYY-MM-01 格式
        revenue: current.revenue,
      };

      // 計算年增率 (YoY)
      if (yearAgo && yearAgo.revenue > 0) {
        metric.yoy = ((current.revenue - yearAgo.revenue) / yearAgo.revenue) * 100;
      }

      // 計算月增率 (MoM)
      if (monthAgo && monthAgo.revenue > 0) {
        metric.mom = ((current.revenue - monthAgo.revenue) / monthAgo.revenue) * 100;
      }

      metrics.push(metric);
    }

    return metrics;
  }

  /**
   * 儲存成長指標到資料庫
   */
  private async saveGrowthMetrics(metrics: GrowthMetrics[]): Promise<void> {
    const db = this.getDb();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO growth_metrics
      (stock_id, month, revenue, yoy, mom, eps, eps_qoq)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((metricsArray: GrowthMetrics[]) => {
      for (const metric of metricsArray) {
        insertStmt.run(
          metric.stock_id,
          metric.month,
          metric.revenue || null,
          metric.yoy || null,
          metric.mom || null,
          metric.eps || null,
          metric.eps_qoq || null
        );
      }
    });

    transaction(metrics);
  }

  /**
   * 從資料庫取得成長指標
   */
  getGrowthMetrics(stockId: string, startMonth?: string, endMonth?: string): GrowthMetrics[] {
    const db = this.getDb();
    let query = 'SELECT * FROM growth_metrics WHERE stock_id = ?';
    const params: any[] = [stockId];

    if (startMonth) {
      query += ' AND month >= ?';
      params.push(startMonth);
    }

    if (endMonth) {
      query += ' AND month <= ?';
      params.push(endMonth);
    }

    query += ' ORDER BY month';

    const stmt = db.prepare(query);
    return stmt.all(...params) as GrowthMetrics[];
  }

  /**
   * 向後相容的方法，供舊版 CLI 使用
   */
  async fetchGrowthData(stockId: string, startDate: string, endDate: string): Promise<GrowthMetrics[]> {
    return this.fetchRevenueGrowth(stockId, startDate, endDate);
  }

  /**
   * 批次抓取多個股票的成長資料
   */
  async fetchMultipleStocks(
    stockIds: string[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, GrowthMetrics[]>> {
    const results = new Map<string, GrowthMetrics[]>();

    for (const stockId of stockIds) {
      try {
        const metrics = await this.fetchRevenueGrowth(stockId, startDate, endDate);
        results.set(stockId, metrics);

        // 避免 API 限制，稍微延遲
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`❌ 抓取 ${stockId} 失敗:`, error);
        results.set(stockId, []);
      }
    }

    return results;
  }

  /**
   * 關閉資料庫連接
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
