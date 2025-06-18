import { FinMindClient, StockPriceData } from '../utils/finmindClient.js';import Database from 'better-sqlite3';import path from 'path';import fs from 'fs';export interface MomentumMetrics {  stock_id: string;  date: string;  rsi?: number;  sma_20?: number;  price_change_1m?: number;}/** * 動能指標資料擷取器 * 負責抓取和處理技術指標資料 */export class MomentumFetcher {  private client: FinMindClient;  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(finmindToken?: string, dbPath: string = 'data/fundamentals.db') {
    this.client = new FinMindClient(finmindToken);
    this.dbPath = dbPath;
    this.getDb();
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

    // 創建動能指標表
    db.exec(`
      CREATE TABLE IF NOT EXISTS momentum_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        date TEXT NOT NULL,
        rsi REAL,
        sma_20 REAL,
        price_change_1m REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, date)
      )
    `);

    console.log('動能指標資料庫初始化完成');
  }

  /**
   * 初始化資料庫連接
   */
  async initialize(): Promise<void> {
    this.getDb();
    console.log('動能指標資料庫初始化完成');
  }

  /**
   * 抓取動能指標資料
   */
  async fetchMomentumData(): Promise<MomentumMetrics[]> {
    try {
      console.log('開始抓取動能資料...');

      // 暫時返回空陣列，避免錯誤
      console.log('⚠️  動能指標功能尚未實作，跳過技術指標計算');
      return [];

    } catch (error) {
      console.error('❌ 動能資料抓取失敗:', error);
      return [];
    }
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
