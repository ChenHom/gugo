import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import { DB_CONFIG } from '../constants/index.js';
import { ErrorHandler } from './errorHandler.js';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = DB_CONFIG.PATH) {
    this.dbPath = dbPath;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Initialize database
      this.db = new Database(this.dbPath, { timeout: DB_CONFIG.TIMEOUT });
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('cache_size = 1000');

      // Run migrations
      await this.runMigrations();
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'DatabaseManager.initialize');
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      const migrationsDir = 'migrations';
      const files = await fs.readdir(migrationsDir);
      const migrationFiles = files
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        const sql = await fs.readFile(filePath, 'utf-8');
        this.db.exec(sql);
      }
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'DatabaseManager.runMigrations');
      throw error;
    }
  }

  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Helper methods for common operations
  async upsertValuation(data: {
    stockNo: string;
    date: string;
    per?: number | undefined;
    pbr?: number | undefined;
    dividendYield?: number | undefined;
  }): Promise<void> {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO valuation (stock_no, date, per, pbr, dividend_yield)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(data.stockNo, data.date, data.per, data.pbr, data.dividendYield);
  }

  async upsertGrowth(data: {
    stockNo: string;
    month: string;
    revenue?: number | undefined;
    yoy?: number | undefined;
    mom?: number | undefined;
    eps?: number | undefined;
    epsQoQ?: number | undefined;
  }): Promise<void> {
    const db = this.getDatabase();
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO growth (stock_no, month, revenue, yoy, mom, eps, eps_qoq)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(data.stockNo, data.month, data.revenue, data.yoy, data.mom, data.eps, data.epsQoQ);
  }

  async getValuationData(stockNo?: string, date?: string): Promise<any[]> {
    const db = this.getDatabase();
    let query = 'SELECT * FROM valuation';
    const params: any[] = [];

    if (stockNo && date) {
      query += ' WHERE stock_no = ? AND date = ?';
      params.push(stockNo, date);
    } else if (stockNo) {
      query += ' WHERE stock_no = ?';
      params.push(stockNo);
    } else if (date) {
      query += ' WHERE date = ?';
      params.push(date);
    }

    query += ' ORDER BY date DESC, stock_no';

    return db.prepare(query).all(...params);
  }

  async getGrowthData(stockNo?: string, month?: string): Promise<any[]> {
    const db = this.getDatabase();
    let query = 'SELECT * FROM growth';
    const params: any[] = [];

    if (stockNo && month) {
      query += ' WHERE stock_no = ? AND month = ?';
      params.push(stockNo, month);
    } else if (stockNo) {
      query += ' WHERE stock_no = ?';
      params.push(stockNo);
    } else if (month) {
      query += ' WHERE month = ?';
      params.push(month);
    }

    query += ' ORDER BY month DESC, stock_no';

    return db.prepare(query).all(...params);
  }
}
