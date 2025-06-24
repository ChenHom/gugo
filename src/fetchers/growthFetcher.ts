import { FinMindClient, MonthlyRevenueData } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import pLimit from 'p-limit';

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
   * 初始化資料庫連接
   */
  async initialize(): Promise<void> {
    this.getDb();
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
        console.log(`⚠️  ${stockId} 無營收資料 - 可能該股票尚未上市或該期間無資料`);
        return [];
      }

      // 計算成長率
      const growthMetrics = this.calculateGrowthRates(revenueData);

      // 儲存到資料庫
      await this.saveGrowthMetrics(growthMetrics);

      console.log(`✅ 成功計算 ${growthMetrics.length} 期營收成長資料`);
      return growthMetrics;

    } catch (error) {
      // 區分不同類型的錯誤給出友善提示
      if (error instanceof Error) {
        if (error.message.includes('404') || error.message.includes('Not Found')) {
          console.warn(`⚠️  ${stockId} 該期間無營收資料 - API 回傳 404`);
          return [];
        } else if (error.message.includes('Failed to fetch')) {
          console.error(`❌ ${stockId} 網路連線問題 - 請檢查網路或稍後重試`);
        } else {
          console.error(`❌ ${stockId} 營收資料處理失敗:`, error.message);
        }
      } else {
        console.error(`❌ 抓取 ${stockId} 營收成長資料失敗:`, error);
      }

      // 不再拋出錯誤，而是回傳空陣列讓程式繼續執行
      return [];
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
      if (!current) continue; // 添加安全檢查

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
  async fetchGrowthData(stockId: string, startDate: string, endDate: string): Promise<GrowthMetrics[]>;
  async fetchGrowthData(stockIds: string[]): Promise<GrowthMetrics[]>;
  async fetchGrowthData(
    stockIdOrIds: string | string[],
    startDate?: string,
    endDate?: string
  ): Promise<GrowthMetrics[]> {
    if (Array.isArray(stockIdOrIds)) {
      // 處理數組輸入 - 用於測試和批次處理
      const results: GrowthMetrics[] = [];
      const defaultEndDate = new Date().toISOString().split('T')[0]!;
      const defaultStartDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      for (const stockId of stockIdOrIds) {
        try {
          const metrics = await this.fetchRevenueGrowth(stockId, defaultStartDate, defaultEndDate);
          results.push(...metrics);
          console.log(`✅ 成功抓取 ${stockId} 的成長資料，共 ${metrics.length} 筆`);
        } catch (error) {
          console.log(`⚠️  查無 ${stockId} 的成長性數據`);
          console.error(`❌ 抓取 ${stockId} 失敗:`, error);
        }
      }
      return results;
    } else {
      // 處理單一股票輸入
      return this.fetchRevenueGrowth(stockIdOrIds, startDate!, endDate!);
    }
  }

  /**
   * 批次抓取多個股票的成長資料
   */
  async fetchMultipleStocks(
    stockIds: string[],
    startDate: string,
    endDate: string,
    concurrency: number = 3
  ): Promise<Map<string, GrowthMetrics[]>> {
    const results = new Map<string, GrowthMetrics[]>();
    const limit = pLimit(concurrency);

    await Promise.all(
      stockIds.map(stockId =>
        limit(async () => {
          try {
            const metrics = await this.fetchRevenueGrowth(stockId, startDate, endDate);
            results.set(stockId, metrics);
          } catch (error) {
            console.error(`❌ 抓取 ${stockId} 失敗:`, error);
            results.set(stockId, []);
          }
        })
      )
    );

    return results;
  }

  /**
   * CLI 相容性方法 - 抓取營收資料
   */
  async fetchRevenueData(options: {
    stockNos?: string[];
    useCache?: boolean;
    concurrency?: number;
  } = {}): Promise<{ success: boolean; data?: GrowthMetrics[]; error?: string }> {
    try {
      const stockIds: string[] = options.stockNos || ['2330', '2317', '2454']; // 預設股票
      const endDate: string = new Date().toISOString().split('T')[0]!;
      const startDate: string = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      const allData: GrowthMetrics[] = [];
      const limit = pLimit(options.concurrency ?? 3);

      await Promise.all(
        stockIds.map(stockId =>
          limit(async () => {
            try {
              const metrics = await this.fetchRevenueGrowth(stockId, startDate, endDate);
              allData.push(...metrics);
            } catch (error) {
              console.error(`❌ 抓取 ${stockId} 失敗:`, error);
            }
          })
        )
      );

      return { success: true, data: allData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * CLI 相容性方法 - 抓取 EPS 資料
   */
  async fetchEpsData(opts: {
    stockNos?: string[];
    useCache?: boolean;
  } = {}): Promise<{ success: boolean; data?: GrowthMetrics[]; error?: string }> {
    try {
      const stockNos = opts.stockNos || ['2330', '2317', '2454']; // 預設股票
      const allEpsData: GrowthMetrics[] = [];

      for (const stockNo of stockNos) {
        try {
          // 使用 FinMind API 獲取財務報表資料 (包含 EPS)
          const startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 2); // 抓取最近 2 年的資料
          const startDateStr = startDate.toISOString().split('T')[0] || '2022-01-01';

          const financialData = await this.client.getFinancialStatements(
            stockNo,
            startDateStr,
            undefined
          );

          // 從財務報表中提取 EPS 資料
          const epsData = this.client.extractEpsFromFinancialStatements(financialData);

          // 計算 EPS 季成長率
          const epsMetrics = this.calculateEpsGrowthRates(stockNo, epsData);
          allEpsData.push(...epsMetrics);

          // 儲存到資料庫
          await this.saveGrowthMetrics(epsMetrics);

        } catch (error) {
          console.warn(`⚠️  ${stockNo} EPS 資料獲取失敗:`, error instanceof Error ? error.message : String(error));
        }
      }

      console.log(`✅ EPS 資料處理完成，共 ${allEpsData.length} 筆記錄`);
      return { success: true, data: allEpsData };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 計算 EPS 季成長率
   */
  private calculateEpsGrowthRates(
    stockId: string,
    epsData: Array<{ date: string; eps: number }>
  ): GrowthMetrics[] {
    if (epsData.length === 0) return [];

    // 按日期排序
    const sortedData = epsData.sort((a, b) => a.date.localeCompare(b.date));
    const metrics: GrowthMetrics[] = [];

    for (let i = 0; i < sortedData.length; i++) {
      const current = sortedData[i];
      if (!current) continue;

      const quarterlyGrowth = i >= 4 && sortedData[i - 4] ?
        ((current.eps - sortedData[i - 4]!.eps) / Math.abs(sortedData[i - 4]!.eps)) * 100 :
        0;

      metrics.push({
        stock_id: stockId,
        month: current.date.substring(0, 7), // YYYY-MM 格式
        eps: current.eps,
        eps_qoq: quarterlyGrowth
      });
    }

    return metrics;
  }

  /**
   * 取得已儲存的成長資料
   */
  async getStoredGrowthData(
    stockId?: string,
    limit?: number
  ): Promise<Array<{
    stockNo: string;
    month: string;
    revenue: number;
    yoy: number;
    eps?: number;
  }>> {
    const db = this.getDb();

    let sql = `
      SELECT stock_id as stockNo, month, revenue, yoy, eps
      FROM growth_metrics
      WHERE 1=1
    `;

    const params: any[] = [];

    if (stockId) {
      sql += ' AND stock_id = ?';
      params.push(stockId);
    }

    sql += ' ORDER BY month DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
    }

    const stmt = db.prepare(sql);
    return stmt.all(...params) as any[];
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
