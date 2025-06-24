import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ApiClient } from './apiClient.js';
import { TWSE_ENDPOINTS } from '../constants/index.js';

export interface StockInfo {
  stockNo: string;
  name: string;
  industry?: string;
  market?: string;
  updatedAt?: string;
}

export interface StockListStats {
  total: number;
  byMarket: Record<string, number>;
  lastUpdated: string | null;
}

export class StockListService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private apiClient: ApiClient;

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'fundamentals.db');
    this.apiClient = new ApiClient();
  }

  async initialize(): Promise<void> {
    this.getDb();
    await this.apiClient.initialize();
  }

  private getDb(): Database.Database {
    if (!this.db) {
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

    // 建立股票清單表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_list (
        stockNo   TEXT PRIMARY KEY,
        name      TEXT,
        industry  TEXT,
        market    TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 建立 meta 表
    db.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key       TEXT PRIMARY KEY,
        value     TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 建立索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_stock_list_market ON stock_list(market);
      CREATE INDEX IF NOT EXISTS idx_stock_list_industry ON stock_list(industry);
      CREATE INDEX IF NOT EXISTS idx_stock_list_updated ON stock_list(updatedAt);
    `);

    console.log('股票清單資料庫初始化完成');
  }

  /**
   * 從 TWSE API 更新股票清單
   */
  async updateStockList(): Promise<number> {
    try {
      console.log('📋 開始更新股票清單...');

      // 從 TWSE 取得股票清單
      const stockData = await this.fetchStockListFromTWSE();

      if (stockData.length === 0) {
        console.log('⚠️  未取得股票清單資料');
        return 0;
      }

      // 儲存到資料庫
      const savedCount = await this.saveStockList(stockData);

      // 更新 meta 資料
      await this.updateMeta('stock_list_last_updated', new Date().toISOString());

      console.log(`✅ 成功更新 ${savedCount} 支股票資料`);
      return savedCount;

    } catch (error) {
      console.error('❌ 更新股票清單失敗:', error);
      throw error;
    }
  }

  /**
   * 從 TWSE API 取得股票清單
   */
  private async fetchStockListFromTWSE(): Promise<StockInfo[]> {
    try {
      // 使用 TWSE 股票基本資料 API
      const rawData = await this.apiClient.get<any[]>(
        TWSE_ENDPOINTS.COMPANY_INFO,
        { response: 'json' },
        false // 不使用快取，確保取得最新資料
      );

      return this.parseStockData(rawData);

    } catch (error) {
      console.error('從 TWSE 取得股票清單失敗:', error);
      // 如果 API 失敗，回傳空陣列，保持現有資料
      return [];
    }
  }

  /**
   * 解析 TWSE API 回傳的股票資料
   */
  private parseStockData(rawData: any[]): StockInfo[] {
    if (!Array.isArray(rawData)) {
      return [];
    }

    return rawData
      .filter(item => item && item.Code && /^\d{4}$/.test(item.Code))
      .map(item => ({
        stockNo: item.Code.trim(),
        name: item.Name?.trim() || '',
        industry: item.Industry?.trim(),
        market: this.determineMarket(item.Market || item.Type),
      }))
      .filter(stock => stock.stockNo && stock.name);
  }

  /**
   * 判斷股票市場類別
   */
  private determineMarket(marketCode: string): string {
    if (!marketCode) return '未知';

    const code = marketCode.toUpperCase();
    if (code.includes('TSE') || code.includes('上市')) return '上市';
    if (code.includes('OTC') || code.includes('上櫃')) return '上櫃';
    if (code.includes('EMERGING') || code.includes('興櫃')) return '興櫃';

    return '未知';
  }

  /**
   * 儲存股票清單到資料庫
   */
  private async saveStockList(stocks: StockInfo[]): Promise<number> {
    const db = this.getDb();
    let savedCount = 0;

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO stock_list
      (stockNo, name, industry, market, updatedAt)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);

    const transaction = db.transaction((stockList: StockInfo[]) => {
      for (const stock of stockList) {
        try {
          stmt.run(stock.stockNo, stock.name, stock.industry, stock.market);
          savedCount++;
        } catch (error) {
          console.error(`儲存股票 ${stock.stockNo} 失敗:`, error);
        }
      }
    });

    transaction(stocks);
    return savedCount;
  }

  /**
   * 取得所有股票清單
   */
  getAllStocks(): StockInfo[] {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT stockNo, name, industry, market, updatedAt
      FROM stock_list
      ORDER BY stockNo
    `);

    return stmt.all() as StockInfo[];
  }

  /**
   * 依條件篩選股票
   */
  getStocks(options: {
    market?: string;
    industry?: string;
    limit?: number;
  } = {}): StockInfo[] {
    const db = this.getDb();

    let query = 'SELECT stockNo, name, industry, market, updatedAt FROM stock_list WHERE 1=1';
    const params: any[] = [];

    if (options.market) {
      query += ' AND market = ?';
      params.push(options.market);
    }

    if (options.industry) {
      query += ' AND industry LIKE ?';
      params.push(`%${options.industry}%`);
    }

    query += ' ORDER BY stockNo';

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }

    const stmt = db.prepare(query);
    return stmt.all(...params) as StockInfo[];
  }

  /**
   * 取得股票清單統計資訊
   */
  getStockListStats(): StockListStats {
    const db = this.getDb();

    // 總數
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM stock_list');
    const total = (totalStmt.get() as { count: number }).count;

    // 按市場分類統計
    const marketStmt = db.prepare(`
      SELECT market, COUNT(*) as count
      FROM stock_list
      GROUP BY market
    `);
    const marketData = marketStmt.all() as { market: string; count: number }[];
    const byMarket = marketData.reduce((acc, item) => {
      acc[item.market] = item.count;
      return acc;
    }, {} as Record<string, number>);

    // 最後更新時間
    const lastUpdated = this.getMeta('stock_list_last_updated');

    return {
      total,
      byMarket,
      lastUpdated,
    };
  }

  /**
   * 檢查是否需要更新股票清單
   */
  shouldUpdateStockList(): boolean {
    const lastUpdated = this.getMeta('stock_list_last_updated');
    if (!lastUpdated) return true;

    const lastUpdateTime = new Date(lastUpdated);
    const now = new Date();
    const diffHours = (now.getTime() - lastUpdateTime.getTime()) / (1000 * 60 * 60);

    return diffHours >= 24; // 超過 24 小時需要更新
  }

  /**
   * 取得 meta 資料
   */
  private getMeta(key: string): string | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT value FROM meta WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  /**
   * 更新 meta 資料
   */
  private async updateMeta(key: string, value: string): Promise<void> {
    const db = this.getDb();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO meta (key, value, updatedAt)
      VALUES (?, ?, datetime('now'))
    `);
    stmt.run(key, value);
  }

  /**
   * 關閉資料庫連線
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}