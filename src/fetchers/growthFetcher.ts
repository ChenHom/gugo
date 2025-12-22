import { FinMindClient, MonthlyRevenueData } from '../utils/finmindClient.js';
import { TWSeApiClient } from '../utils/twseApiClient.js';
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
 * 優先使用 TWSE OpenAPI，失敗時回退到 FinMind API
 */
export class GrowthFetcher {
  private finmindClient: FinMindClient;
  private twseClient: TWSeApiClient;
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(finmindToken?: string, dbPath: string = 'data/fundamentals.db') {
    this.finmindClient = new FinMindClient(finmindToken);
    this.twseClient = new TWSeApiClient();
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
   * 優先使用 TWSE OpenAPI，失敗時回退到 FinMind API
   */
  async fetchRevenueGrowth(
    stockId: string,
    startDate: string,
    endDate: string
  ): Promise<GrowthMetrics[]> {
    if (process.env.DEBUG) {
      console.log(`📈 抓取營收成長資料: ${stockId} (${startDate} ~ ${endDate})`);
    }

    // 首先檢查資料庫中是否已有資料
    const existingData = this.getGrowthMetrics(stockId, startDate, endDate);
    if (existingData.length > 0) {
      if (process.env.DEBUG) {
        console.log(`🗄️ 資料庫中已有 ${existingData.length} 筆 ${stockId} 營收資料，直接使用`);
      }
      return existingData;
    }

    // 方法1: 嘗試使用 TWSE OpenAPI
    try {
      if (process.env.DEBUG) {
        console.log(`🇹🇼 優先嘗試 TWSE OpenAPI...`);
      }
      const twseData = await this.fetchRevenueFromTWSE(stockId, startDate, endDate);
      if (twseData && twseData.length > 0) {
        console.log(`✅ TWSE API 成功獲取 ${twseData.length} 期營收成長資料`);
        await this.saveGrowthMetrics(twseData);
        return twseData;
      }
    } catch (error) {
      console.warn(`⚠️  TWSE API 失敗，回退到 FinMind:`, error instanceof Error ? error.message : error);
    }

    // 方法2: 回退到 FinMind API
    try {
      console.log(`🌐 使用 FinMind API 作為備用...`);
      // 為了計算 YoY，向前擴展查詢範圍一整年，以取得去年同期資料
      const finmindStartDate = (() => {
        const d = new Date(startDate);
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
      })();

      const revenueData = await this.finmindClient.getMonthlyRevenue(stockId, finmindStartDate, endDate);

      if (!revenueData || revenueData.length === 0) {
        console.log(`⚠️  ${stockId} 無營收資料 - 可能該股票尚未上市或該期間無資料`);
        return [];
      }

      // 計算成長率
      const growthMetrics = this.calculateGrowthRates(revenueData);

      // 篩選回傳時間區間 (只保留原始 startDate ~ endDate 範圍)
      const start = new Date(startDate);
      const end = new Date(endDate);
      const filteredMetrics = growthMetrics.filter(item => {
        const itemDate = new Date(item.month);
        return itemDate >= start && itemDate <= end;
      });

      // 儲存到資料庫
      await this.saveGrowthMetrics(filteredMetrics);

      console.log(`✅ FinMind API 成功計算 ${filteredMetrics.length} 期營收成長資料`);
      return filteredMetrics;

    } catch (error) {
      // 檢查是否為付費方案限制
      if (error instanceof Error && error.message.includes('402 Payment Required')) {
        console.error(`❌ ${stockId}: FinMind API 需要付費方案，已達免費額度限制`);
        console.log(`💡 建議: 申請 FinMind 付費方案或等待額度重置`);
        return [];
      }

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
   * 從 TWSE OpenAPI 抓取月營收資料
   */
  private async fetchRevenueFromTWSE(
    stockId: string,
    startDate: string,
    endDate: string
  ): Promise<GrowthMetrics[]> {
    const results: GrowthMetrics[] = [];

    // 生成需要查詢的年月範圍
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months: string[] = [];

    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const year = d.getFullYear().toString();
      const month = (d.getMonth() + 1).toString();
      months.push(`${year}-${month}`);
    }

    // 取得現在時間，用於計算月營收可用性
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // 限制只查詢最近3年資料，避免無效請求
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(currentYear - 3);

    // 先嘗試一次性查詢近期月營收 (可能適用於某些 API 版本)
    try {
      console.log(`🔍 嘗試一次性查詢 ${stockId} 的月營收資料...`);
      // 使用當前月份前一個月份，因為本月可能尚未公布
      let queryMonth = currentMonth - 1;
      let queryYear = currentYear;
      if (queryMonth <= 0) {
        queryMonth = 12;
        queryYear--;
      }

      const twseData = await this.twseClient.getMonthlyRevenue(
        queryYear.toString(),
        queryMonth.toString(),
        stockId
      );

      if (twseData.length > 0) {
        console.log(`✅ 成功取得 ${twseData.length} 筆月營收資料`);
        const convertedData = this.twseClient.convertMonthlyRevenueData(twseData);
        const growthMetrics = this.calculateGrowthRates(convertedData);

        // 如果整批資料中有需要的日期範圍，進行篩選
        const filteredMetrics = growthMetrics.filter(item => {
          const itemDate = new Date(item.month);
          return itemDate >= start && itemDate <= end;
        });

        if (filteredMetrics.length > 0) {
          results.push(...filteredMetrics);
          return results.sort((a, b) => a.month.localeCompare(b.month));
        }
      }
    } catch (error) {
      console.warn(`⚠️ 整批查詢失敗，改為逐月查詢:`, error instanceof Error ? error.message : error);
    }

    // 如果整批查詢失敗，改為逐月查詢
    console.log(`🔄 開始逐月查詢 ${stockId} 的月營收資料...`);
    for (const yearMonth of months) {
      try {
        const [year, month] = yearMonth.split('-');

        // 檢查是否為未來日期，跳過未來日期
        const yearInt = parseInt(year);
        const monthInt = parseInt(month);
        if (yearInt > currentYear || (yearInt === currentYear && monthInt > currentMonth)) {
          console.log(`⏭️ 跳過未來月份 ${yearMonth}`);
          continue;
        }

        // 檢查是否為太久遠的日期
        const monthDate = new Date(`${year}-${month}-01`);
        if (monthDate < threeYearsAgo) {
          console.log(`⏭️ 跳過過於久遠的月份 ${yearMonth}`);
          continue;
        }

        console.log(`📅 查詢 ${stockId} ${yearMonth} 月營收`);
        const twseData = await this.twseClient.getMonthlyRevenue(year, month, stockId);

        // 篩選指定股票的資料
        const stockData = twseData.filter(item => item.公司代號 === stockId);

        if (stockData.length > 0) {
          console.log(`✅ ${yearMonth} 找到 ${stockData.length} 筆 ${stockId} 月營收資料`);
          const convertedData = this.twseClient.convertMonthlyRevenueData(stockData);
          const growthMetrics = this.calculateGrowthRates(convertedData);
          results.push(...growthMetrics);
        } else {
          console.log(`ℹ️ ${yearMonth} 無 ${stockId} 月營收資料`);
        }
      } catch (error) {
        console.warn(`TWSE API 查詢 ${yearMonth} 失敗:`, error instanceof Error ? error.message : error);
      }
    }

    // 如果成功獲取到部分資料，直接返回
    if (results.length > 0) {
      console.log(`✅ TWSE API 成功獲取 ${results.length} 筆 ${stockId} 月營收資料`);
      return results.sort((a, b) => a.month.localeCompare(b.month));
    }

    // 如果沒有取得資料，拋出明確錯誤
    console.warn(`⚠️ TWSE 未能取得 ${stockId} 從 ${startDate} 至 ${endDate} 的月營收資料`);
    throw new Error(`TWSE API 未找到 ${stockId} 的月營收資料`);
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

          const financialData = await this.finmindClient.getFinancialStatements(
            stockNo,
            startDateStr,
            undefined
          );

          // 從財務報表中提取 EPS 資料
          const epsData = this.finmindClient.extractEpsFromFinancialStatements(financialData);

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
