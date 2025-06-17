import { FinMindClient, InstitutionalInvestorsData } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface FundFlowMetrics {
  stock_id: string;
  date: string;
  foreign_net?: number;
  inv_trust_net?: number;
  dealer_net?: number;
  holding_ratio?: number;
}

/**
 * 資金流向資料擷取器
 * 負責抓取和處理三大法人買賣超資料
 */
export class FundFlowFetcher {
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

    // 創建資金流向表
    db.exec(`
      CREATE TABLE IF NOT EXISTS fund_flow_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        date TEXT NOT NULL,
        foreign_net INTEGER,
        inv_trust_net INTEGER,
        dealer_net INTEGER,
        holding_ratio REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, date)
      )
    `);

    console.log('資金流向資料庫初始化完成');
  }

  /**
   * 抓取三大法人資金流向資料
   */
  async fetchInstitutionalFlow(
    stockId: string,
    startDate: string,
    endDate: string
  ): Promise<FundFlowMetrics[]> {
    console.log(`💰 抓取資金流向資料: ${stockId} (${startDate} ~ ${endDate})`);

    try {
      // 抓取三大法人資料
      const institutionalData = await this.client.getInstitutionalInvestors(stockId, startDate, endDate);

      if (!institutionalData || institutionalData.length === 0) {
        console.log(`⚠️  ${stockId} 無三大法人資料`);
        return [];
      }

      // 處理資料
      const flowMetrics = this.processInstitutionalData(institutionalData);

      // 儲存到資料庫
      await this.saveFundFlowMetrics(flowMetrics);

      console.log(`✅ 成功處理 ${flowMetrics.length} 筆資金流向資料`);
      return flowMetrics;

    } catch (error) {
      console.error(`❌ 抓取 ${stockId} 資金流向資料失敗:`, error);
      throw error;
    }
  }

  /**
   * 處理三大法人資料
   */
  private processInstitutionalData(data: InstitutionalInvestorsData[]): FundFlowMetrics[] {
    const metrics: FundFlowMetrics[] = [];

    // 按日期分組
    const groupedByDate = new Map<string, InstitutionalInvestorsData[]>();

    for (const item of data) {
      const date = item.date;
      if (!groupedByDate.has(date)) {
        groupedByDate.set(date, []);
      }
      groupedByDate.get(date)?.push(item);
    }

    // 計算每日的淨買超
    for (const [date, dayData] of groupedByDate) {
      const stockId = dayData[0]?.stock_id;
      if (!stockId) continue;

      let foreignNet = 0;
      let invTrustNet = 0;
      let dealerNet = 0;

      for (const item of dayData) {
        switch (item.name) {
          case '外資及陸資(不含外資自營商)':
          case '外資及陸資':
            foreignNet = item.buy - item.sell;
            break;
          case '投信':
            invTrustNet = item.buy - item.sell;
            break;
          case '自營商(自行買賣)':
          case '自營商':
            dealerNet = item.buy - item.sell;
            break;
        }
      }

      metrics.push({
        stock_id: stockId,
        date: date,
        foreign_net: foreignNet,
        inv_trust_net: invTrustNet,
        dealer_net: dealerNet,
      });
    }

    return metrics.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 儲存資金流向指標到資料庫
   */
  private async saveFundFlowMetrics(metrics: FundFlowMetrics[]): Promise<void> {
    const db = this.getDb();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO fund_flow_metrics
      (stock_id, date, foreign_net, inv_trust_net, dealer_net, holding_ratio)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((metricsArray: FundFlowMetrics[]) => {
      for (const metric of metricsArray) {
        insertStmt.run(
          metric.stock_id,
          metric.date,
          metric.foreign_net || null,
          metric.inv_trust_net || null,
          metric.dealer_net || null,
          metric.holding_ratio || null
        );
      }
    });

    transaction(metrics);
  }

  /**
   * 從資料庫取得資金流向指標
   */
  getFundFlowMetrics(stockId: string, startDate?: string, endDate?: string): FundFlowMetrics[] {
    const db = this.getDb();
    let query = 'SELECT * FROM fund_flow_metrics WHERE stock_id = ?';
    const params: any[] = [stockId];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date';

    const stmt = db.prepare(query);
    return stmt.all(...params) as FundFlowMetrics[];
  }

  /**
   * 向後相容的方法，供舊版 CLI 使用
   */
  async fetchFundFlowData(stockId: string, startDate: string, endDate: string): Promise<FundFlowMetrics[]> {
    return this.fetchInstitutionalFlow(stockId, startDate, endDate);
  }

  /**
   * 批次抓取多個股票的資金流向資料
   */
  async fetchMultipleStocks(
    stockIds: string[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, FundFlowMetrics[]>> {
    const results = new Map<string, FundFlowMetrics[]>();

    for (const stockId of stockIds) {
      try {
        const metrics = await this.fetchInstitutionalFlow(stockId, startDate, endDate);
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
