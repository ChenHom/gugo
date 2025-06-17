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
            growthData.push({
              stockNo: stockNo,
              date: item.date,
              month: item.date,
              revenue: item.revenue,
              yoy: item.yoy,
              mom: item.mom,
              eps: undefined, // EPS 將在 fetchEpsData 中處理
              epsQoQ: undefined,
            });
          });

          // 避免速率限制，稍作延遲
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.warn(`Warning: 無法獲取股票 ${stockNo} 的營收資料:`, (error as Error).message);
          continue;
        }
      }

      // Store in database
      if (growthData.length > 0) {
        await this.storeGrowthData(growthData);
      }

      return {
        success: true,
        data: growthData,
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'GrowthFetcher.fetchRevenueData');
      console.warn('Warning: FinMind 營收API 失敗，回退到空資料');
      return {
        success: true,
        data: [],
      };
    }
  }

  async fetchEpsData(options: FetchOptions = {}): Promise<ApiResponse<GrowthData>> {
    try {
      console.log('使用 FinMind API 抓取 EPS 資料...');

      // 使用 FinMind API 獲取財務報表資料
      const stockNos = options.stockNos || ['2330', '2454', '2881', '2891']; // 預設股票清單
      const growthData: GrowthData[] = [];

      // 設定日期範圍（預設最近2年的季報）
      const endDate: string = new Date().toISOString().split('T')[0] || '';
      const startDate: string = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0] || '';

      for (const stockNo of stockNos.slice(0, 10)) { // 限制數量避免超過速率限制
        try {
          const financialData = await this.finmindClient.getFinancialStatements(
            stockNo,
            startDate,
            endDate
          );

          const epsData = this.finmindClient.extractEpsFromFinancialStatements(financialData);

          // 計算 EPS 季增率
          const sortedEpsData = epsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          sortedEpsData.forEach((item, index) => {
            let epsQoQ = undefined;
            if (index > 0) {
              const prevItem = sortedEpsData[index - 1];
              if (prevItem && prevItem.eps !== 0) {
                epsQoQ = ((item.eps - prevItem.eps) / Math.abs(prevItem.eps)) * 100;
              }
            }

            growthData.push({
              stockNo: stockNo,
              date: item.date,
              month: item.date,
              revenue: undefined, // 營收在 fetchRevenueData 中處理
              yoy: undefined,
              mom: undefined,
              eps: item.eps,
              epsQoQ: epsQoQ,
            });
          });

          // 避免速率限制，稍作延遲
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.warn(`Warning: 無法獲取股票 ${stockNo} 的 EPS 資料:`, (error as Error).message);
          continue;
        }
      }

      // Store in database (merge with existing revenue data)
      if (growthData.length > 0) {
        await this.mergeEpsData(growthData);
      }

      return {
        success: true,
        data: growthData,
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'GrowthFetcher.fetchEpsData');
      console.warn('Warning: FinMind EPS API 失敗，回退到空資料');
      return {
        success: true,
        data: [],
      };
    }
  }

  private parseRevenueData(rawData: any[]): GrowthData[] {
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid API response format');
    }

    // Check if data contains company basic info (t187ap03_L) instead of revenue data
    if (rawData.length > 0 && rawData[0]['公司名稱'] && !rawData[0]['當月營收']) {
      console.warn('Warning: API endpoint returns company basic info, not monthly revenue data. No revenue data available.');
      return [];
    }

    return rawData
      .filter(row => row && typeof row === 'object')
      .map(row => {
        const stockNo = String(row['公司代號'] || '').trim();
        const yearMonth = String(row['年月'] || '').trim();
        const revenue = this.parseNumber(row['當月營收']);
        const yoy = this.parseNumber(row['去年同月增減(％)']);
        const mom = this.parseNumber(row['上月比較增減(％)']);

        if (!stockNo || !yearMonth || !/^\d{4}$/.test(stockNo)) {
          return null;
        }

        // Convert YYYYMM to YYYY-MM-01 format
        const year = yearMonth.substring(0, 4);
        const month = yearMonth.substring(4, 6);
        const monthDate = `${year}-${month}-01`;

        return {
          stockNo,
          date: monthDate,
          month: monthDate,
          revenue,
          yoy,
          mom,
        } as GrowthData;
      })
      .filter((item): item is GrowthData => item !== null) as GrowthData[];
  }

  private parseEpsData(rawData: any[]): GrowthData[] {
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid API response format');
    }

    return rawData
      .filter(row => row && typeof row === 'object')
      .map(row => {
        const stockNo = String(row['公司代號'] || '').trim();
        const eps = this.parseNumber(row['基本每股盈餘(元)']);
        const quarter = String(row['季別'] || '').trim();

        if (!stockNo || !quarter || !/^\d{4}$/.test(stockNo)) {
          return null;
        }

        // Convert quarter to month format (Q1->03, Q2->06, Q3->09, Q4->12)
        const year = quarter.substring(0, 4);
        const q = quarter.substring(4);
        const monthMap: Record<string, string> = { '1': '03', '2': '06', '3': '09', '4': '12' };
        const month = monthMap[q] || '12';
        const monthDate = `${year}-${month}-01`;

        return {
          stockNo,
          date: monthDate,
          month: monthDate,
          eps,
        } as GrowthData;
      })
      .filter((item): item is GrowthData => item !== null) as GrowthData[];
  }

  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value === '-' || value === 'N/A') return undefined;

    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private async storeGrowthData(data: GrowthData[]): Promise<void> {
    for (const item of data) {
      await this.dbManager.upsertGrowth({
        stockNo: item.stockNo,
        month: item.month,
        revenue: item.revenue,
        yoy: item.yoy,
        mom: item.mom,
        eps: item.eps,
        epsQoQ: item.epsQoQ,
      });
    }
  }

  private async mergeEpsData(epsData: GrowthData[]): Promise<void> {
    for (const item of epsData) {
      // Get existing record to preserve revenue data
      const existing = await this.dbManager.getGrowthData(item.stockNo, item.month);
      const existingRecord = existing[0];

      await this.dbManager.upsertGrowth({
        stockNo: item.stockNo,
        month: item.month,
        revenue: existingRecord?.revenue,
        yoy: existingRecord?.yoy,
        mom: existingRecord?.mom,
        eps: item.eps,
        epsQoQ: item.epsQoQ,
      });
    }
  }

  async getStoredGrowthData(stockNo?: string, month?: string): Promise<GrowthData[]> {
    try {
      const rawData = await this.dbManager.getGrowthData(stockNo, month);
      return rawData.map(row => ({
        stockNo: row.stock_no,
        date: row.month,
        month: row.month,
        revenue: row.revenue,
        yoy: row.yoy,
        mom: row.mom,
        eps: row.eps,
        epsQoQ: row.eps_qoq,
      }));
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'GrowthFetcher.getStoredGrowthData');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }
}
