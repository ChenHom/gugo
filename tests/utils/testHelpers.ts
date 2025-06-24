import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * 建立測試資料庫的共用工具
 * 避免在每個測試檔案中重複相同的資料庫設定邏輯
 */

export interface TestDbConfig {
  prefix?: string;
  createTables?: boolean;
  insertTestData?: boolean;
}

/**
 * 建立臨時測試資料庫
 */
export async function createTestDatabase(config: TestDbConfig = {}): Promise<string> {
  const { prefix = 'test', createTables = true, insertTestData = true } = config;

  const tmp = os.tmpdir();
  const dbFile = path.join(tmp, `${prefix}-db-${Date.now()}-${Math.random()}.sqlite`);

  // 設定環境變數讓測試使用這個資料庫
  process.env.DB_PATH = dbFile;

  if (createTables) {
    const db = new Database(dbFile);

    // 建立基本資料表結構
    db.exec(`
      CREATE TABLE IF NOT EXISTS valuation (
        stock_no TEXT,
        date TEXT,
        per REAL,
        pbr REAL,
        dividend_yield REAL,
        PRIMARY KEY(stock_no, date)
      );

      CREATE TABLE IF NOT EXISTS growth (
        stock_no TEXT,
        month TEXT,
        revenue INTEGER,
        yoy REAL,
        mom REAL,
        eps REAL,
        eps_qoq REAL,
        PRIMARY KEY(stock_no, month)
      );

      CREATE TABLE IF NOT EXISTS quality (
        stock_no TEXT,
        year INTEGER,
        roe REAL,
        gross_margin REAL,
        op_margin REAL,
        PRIMARY KEY(stock_no, year)
      );

      CREATE TABLE IF NOT EXISTS fundflow (
        stock_no TEXT,
        date TEXT,
        foreign_net REAL,
        inv_trust_net REAL,
        dealer_net REAL,
        PRIMARY KEY(stock_no, date)
      );

      CREATE TABLE IF NOT EXISTS price_daily (
        stock_no TEXT,
        date TEXT,
        close REAL,
        volume INTEGER,
        PRIMARY KEY(stock_no, date)
      );

      CREATE TABLE IF NOT EXISTS stock_scores (
        stock_no TEXT,
        date TEXT,
        total_score REAL,
        market_value REAL,
        valuation_score REAL,
        growth_score REAL,
        quality_score REAL,
        momentum_score REAL,
        PRIMARY KEY(stock_no, date)
      );
    `);

    if (insertTestData) {
      insertSampleData(db);
    }

    db.close();
  }

  return dbFile;
}

/**
 * 插入測試資料
 */
export function insertSampleData(db: Database.Database): void {
  // 準備 SQL 語句
  const insV = db.prepare('INSERT OR REPLACE INTO valuation VALUES (?, ?, ?, ?, ?)');
  const insG = db.prepare('INSERT OR REPLACE INTO growth VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insQ = db.prepare('INSERT OR REPLACE INTO quality VALUES (?, ?, ?, ?, ?)');
  const insC = db.prepare('INSERT OR REPLACE INTO fundflow VALUES (?, ?, ?, ?, ?)');
  const insM = db.prepare('INSERT OR REPLACE INTO price_daily VALUES (?, ?, ?, ?)');
  const insS = db.prepare('INSERT OR REPLACE INTO stock_scores VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

  // 插入兩支測試股票的資料
  const testStocks = [
    { code: '2330', multiplier: 100 }, // 台積電
    { code: '2317', multiplier: 50 },  // 鴻海
    { code: '2454', multiplier: 25 }   // 聯發科
  ];

  for (const { code, multiplier } of testStocks) {
    // 估值資料
    insV.run(code, '2024-01-01', multiplier * 0.15, multiplier * 0.02, multiplier * 0.03);
    insV.run(code, '2024-06-01', multiplier * 0.16, multiplier * 0.021, multiplier * 0.032);

    // 成長資料
    insG.run(code, '2024-01', multiplier * 1000000, 0.15, 0.05, multiplier * 0.5, 0.1);
    insG.run(code, '2024-06', multiplier * 1100000, 0.12, 0.08, multiplier * 0.6, 0.2);

    // 品質資料
    insQ.run(code, 2023, 0.15, 0.25, 0.12);
    insQ.run(code, 2024, 0.18, 0.27, 0.15);

    // 資金流向資料
    insC.run(code, '2024-01-01', multiplier * 100, multiplier * 50, multiplier * 10);
    insC.run(code, '2024-06-01', multiplier * 120, multiplier * 60, multiplier * 15);

    // 股價資料
    insM.run(code, '2024-01-01', multiplier * 1.0, multiplier * 1000);
    insM.run(code, '2024-06-01', multiplier * 1.2, multiplier * 1200);

    // 評分資料
    insS.run(code, '2024-06-01', 75 + (multiplier / 10), multiplier * 1000000,
             70, 80, 75, 70);
  }
}

/**
 * 清理測試資料庫
 */
export function cleanupTestDatabase(dbFile: string): void {
  try {
    if (fs.existsSync(dbFile)) {
      fs.unlinkSync(dbFile);
    }
  } catch (error) {
    console.warn(`清理測試資料庫失敗: ${error}`);
  }

  // 清理環境變數
  delete process.env.DB_PATH;
}

/**
 * 為測試建立 mock 資料
 */
export function createMockStockData() {
  return {
    priceData: [
      { stock_id: '2330', date: '2024-01-01', close: 100, volume: 1000 },
      { stock_id: '2330', date: '2024-01-02', close: 101, volume: 1100 },
      { stock_id: '2330', date: '2024-01-03', close: 99, volume: 900 },
    ],
    valuationData: [
      { stockNo: '2330', date: '2024-01-01', per: 15.5, pbr: 2.1, dividendYield: 3.2 }
    ],
    growthData: [
      { stockNo: '2330', month: '2024-01', yoy: 15.2, mom: 5.1, eps_qoq: 10.3 }
    ]
  };
}

/**
 * 等待指定毫秒數（用於測試異步操作）
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 建立臨時目錄
 */
export function createTempDir(prefix: string = 'test'): string {
  const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * 清理臨時目錄
 */
export function cleanupTempDir(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (error) {
    console.warn(`清理臨時目錄失敗: ${error}`);
  }
}
