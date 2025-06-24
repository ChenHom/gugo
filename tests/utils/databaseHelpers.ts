import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * 專門用於測試的資料庫設定工具
 * 提供統一的測試資料庫建立、初始化和清理功能
 */

export interface DatabaseTestConfig {
  dbName?: string;
  createSchema?: boolean;
  insertSampleData?: boolean;
  useMemoryDb?: boolean;
}

/**
 * 建立測試資料庫實例
 */
export class DatabaseTestHelper {
  private db: Database.Database | null = null;
  private dbPath: string | null = null;
  private isMemoryDb: boolean = false;

  constructor(private config: DatabaseTestConfig = {}) {
    this.isMemoryDb = config.useMemoryDb ?? false;
  }

  /**
   * 初始化測試資料庫
   */
  async initialize(): Promise<string> {
    if (this.isMemoryDb) {
      this.dbPath = ':memory:';
    } else {
      const tmp = os.tmpdir();
      const dbName = this.config.dbName || 'test';
      this.dbPath = path.join(tmp, `${dbName}-${Date.now()}-${Math.random()}.sqlite`);
    }

    this.db = new Database(this.dbPath);

    if (this.config.createSchema !== false) {
      await this.createSchema();
    }

    if (this.config.insertSampleData === true) {
      await this.insertSampleData();
    }

    // 設定環境變數
    if (!this.isMemoryDb) {
      process.env.DB_PATH = this.dbPath;
    }

    return this.dbPath;
  }

  /**
   * 建立資料庫結構
   */
  private async createSchema(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      -- 估值資料表
      CREATE TABLE IF NOT EXISTS valuation (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        per REAL,
        pbr REAL,
        dividend_yield REAL,
        PRIMARY KEY(stock_no, date)
      );

      -- 成長資料表
      CREATE TABLE IF NOT EXISTS growth (
        stock_no TEXT NOT NULL,
        month TEXT NOT NULL,
        revenue INTEGER,
        yoy REAL,
        mom REAL,
        eps REAL,
        eps_qoq REAL,
        PRIMARY KEY(stock_no, month)
      );

      -- 品質資料表
      CREATE TABLE IF NOT EXISTS quality (
        stock_no TEXT NOT NULL,
        year INTEGER NOT NULL,
        roe REAL,
        gross_margin REAL,
        op_margin REAL,
        debt_ratio REAL,
        current_ratio REAL,
        PRIMARY KEY(stock_no, year)
      );

      -- 資金流向資料表
      CREATE TABLE IF NOT EXISTS fund_flow (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        foreign_net REAL,
        inv_trust_net REAL,
        dealer_net REAL,
        PRIMARY KEY(stock_no, date)
      );

      -- 股價資料表
      CREATE TABLE IF NOT EXISTS price_daily (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        close REAL NOT NULL,
        volume INTEGER,
        high REAL,
        low REAL,
        PRIMARY KEY(stock_no, date)
      );

      -- 評分資料表
      CREATE TABLE IF NOT EXISTS stock_scores (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        total_score REAL,
        market_value REAL,
        valuation_score REAL,
        growth_score REAL,
        quality_score REAL,
        momentum_score REAL,
        fund_flow_score REAL,
        PRIMARY KEY(stock_no, date)
      );

      -- 動能指標表
      CREATE TABLE IF NOT EXISTS momentum_metrics (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        ma_5 REAL,
        ma_20 REAL,
        ma_60 REAL,
        rsi REAL,
        macd REAL,
        price_change_1m REAL,
        PRIMARY KEY(stock_no, date)
      );

      -- 建立索引
      CREATE INDEX IF NOT EXISTS idx_valuation_stock_date ON valuation(stock_no, date);
      CREATE INDEX IF NOT EXISTS idx_growth_stock_month ON growth(stock_no, month);
      CREATE INDEX IF NOT EXISTS idx_quality_stock_year ON quality(stock_no, year);
      CREATE INDEX IF NOT EXISTS idx_fund_flow_stock_date ON fund_flow(stock_no, date);
      CREATE INDEX IF NOT EXISTS idx_price_stock_date ON price_daily(stock_no, date);
      CREATE INDEX IF NOT EXISTS idx_scores_total_score ON stock_scores(total_score);
    `);
  }

  /**
   * 插入測試資料
   */
  private async insertSampleData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // 測試股票清單
    const testStocks = [
      { code: '2330', name: '台積電', basePrice: 600 },
      { code: '2317', name: '鴻海', basePrice: 120 },
      { code: '2454', name: '聯發科', basePrice: 800 }
    ];

    const transaction = this.db.transaction(() => {
      for (const stock of testStocks) {
        // 插入估值資料
        this.db!.prepare(`
          INSERT OR REPLACE INTO valuation
          (stock_no, date, per, pbr, dividend_yield)
          VALUES (?, ?, ?, ?, ?)
        `).run(stock.code, '2024-01-01', 15.5, 2.1, 3.2);

        // 插入成長資料
        this.db!.prepare(`
          INSERT OR REPLACE INTO growth
          (stock_no, month, revenue, yoy, mom, eps, eps_qoq)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(stock.code, '2024-01', 1000000000, 15.2, 5.1, 25.5, 10.3);

        // 插入品質資料
        this.db!.prepare(`
          INSERT OR REPLACE INTO quality
          (stock_no, year, roe, gross_margin, op_margin, debt_ratio, current_ratio)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(stock.code, 2024, 15.8, 45.2, 25.3, 0.3, 1.5);

        // 插入資金流向資料
        this.db!.prepare(`
          INSERT OR REPLACE INTO fund_flow
          (stock_no, date, foreign_net, inv_trust_net, dealer_net)
          VALUES (?, ?, ?, ?, ?)
        `).run(stock.code, '2024-01-01', 1000, 500, -200);

        // 插入股價資料（最近30天）
        for (let i = 0; i < 30; i++) {
          const date = new Date('2024-01-01');
          date.setDate(date.getDate() + i);
          const dateStr = date.toISOString().split('T')[0];

          const priceVariation = (Math.random() - 0.5) * 0.1; // ±5% 變動
          const price = stock.basePrice * (1 + priceVariation);

          this.db!.prepare(`
            INSERT OR REPLACE INTO price_daily
            (stock_no, date, close, volume, high, low)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(stock.code, dateStr, price, 1000000, price * 1.02, price * 0.98);
        }

        // 插入評分資料
        this.db!.prepare(`
          INSERT OR REPLACE INTO stock_scores
          (stock_no, date, total_score, market_value, valuation_score, growth_score, quality_score, momentum_score, fund_flow_score)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(stock.code, '2024-01-01', 75.5, 1000000000, 70, 80, 75, 70, 85);
      }
    });

    transaction();
  }

  /**
   * 取得資料庫實例
   */
  getDatabase(): Database.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  /**
   * 取得資料庫路徑
   */
  getDatabasePath(): string {
    if (!this.dbPath) throw new Error('Database not initialized');
    return this.dbPath;
  }

  /**
   * 清理資料庫
   */
  async cleanup(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }

    if (this.dbPath && this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
      try {
        fs.unlinkSync(this.dbPath);
      } catch (error) {
        console.warn(`清理測試資料庫失敗: ${error}`);
      }
    }

    // 清理環境變數
    delete process.env.DB_PATH;
  }

  /**
   * 重設資料庫（清空所有資料）
   */
  async reset(): Promise<void> {
    if (!this.db) return;

    const tables = [
      'valuation', 'growth', 'quality', 'fund_flow',
      'price_daily', 'stock_scores', 'momentum_metrics'
    ];

    for (const table of tables) {
      try {
        this.db.exec(`DELETE FROM ${table}`);
      } catch (error) {
        // 忽略表格不存在的錯誤
      }
    }
  }

  /**
   * 執行自訂 SQL
   */
  exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(sql);
  }

  /**
   * 查詢資料
   */
  query(sql: string, params: any[] = []): any[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(sql).all(...params);
  }
}
