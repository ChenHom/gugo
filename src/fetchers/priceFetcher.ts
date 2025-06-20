import { FinMindClient } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface PriceData {
  stock_id: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trading_money: number;
}

export interface ValuationData {
  stock_id: string;
  date: string;
  per: number;
  pbr: number;
  dividend_yield: number;
}

/**
 * 價格與估值資料擷取器
 * 使用 FinMind API 獲取股價與 PER/PBR 資料
 */
export class PriceFetcher {
  private client: FinMindClient;
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(finmindToken?: string) {
    this.client = new FinMindClient(finmindToken);
    this.dbPath = path.join(process.cwd(), 'data', 'price.db');
  }

  async initialize(): Promise<void> {
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

    // 創建股價表
    db.exec(`
      CREATE TABLE IF NOT EXISTS stock_prices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        date TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume INTEGER NOT NULL,
        trading_money REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, date)
      )
    `);

    // 創建估值表
    db.exec(`
      CREATE TABLE IF NOT EXISTS valuations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        date TEXT NOT NULL,
        per REAL,
        pbr REAL,
        dividend_yield REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, date)
      )
    `);

    console.log('價格資料庫初始化完成');
  }

  /**
   * 獲取股價資料
   */
  async fetchStockPrice(
    stockId: string,
    startDate: string,
    endDate: string | undefined
  ): Promise<PriceData[]> {
    try {
      console.log(`📈 抓取股價資料: ${stockId} (${startDate} ~ ${endDate || '今日'})`);

      const rawData = await this.client.getStockPrice(stockId, startDate, endDate);

      const priceData: PriceData[] = rawData.map(item => ({
        stock_id: item.stock_id,
        date: item.date,
        open: item.open,
        high: item.max,
        low: item.min,
        close: item.close,
        volume: item.Trading_Volume,
        trading_money: item.Trading_money,
      }));

      // 儲存到資料庫
      this.savePriceData(priceData);

      console.log(`✅ 成功獲得 ${priceData.length} 筆股價資料`);
      return priceData;

    } catch (error) {
      console.error(`❌ 抓取股價資料失敗 (${stockId}):`, error);
      return [];
    }
  }

  /**
   * 獲取估值資料 (PER/PBR)
   */
  async fetchValuation(
    stockId: string,
    startDate: string,
    endDate: string | undefined
  ): Promise<ValuationData[]> {
    try {
      console.log(`📊 抓取估值資料: ${stockId} (${startDate} ~ ${endDate || '今日'})`);

      const rawData = await this.client.getStockPER(stockId, startDate, endDate);

      const valuationData: ValuationData[] = rawData.map(item => ({
        stock_id: item.stock_id,
        date: item.date,
        per: item.PER,
        pbr: item.PBR,
        dividend_yield: item.dividend_yield,
      }));

      // 儲存到資料庫
      this.saveValuationData(valuationData);

      console.log(`✅ 成功獲得 ${valuationData.length} 筆估值資料`);
      return valuationData;

    } catch (error) {
      console.error(`❌ 抓取估值資料失敗 (${stockId}):`, error);
      return [];
    }
  }

  /**
   * 儲存股價資料到資料庫
   */
  private savePriceData(data: PriceData[]): void {
    if (data.length === 0) return;

    const db = this.getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO stock_prices
       (stock_id, date, open, high, low, close, volume, trading_money)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of data) {
      try {
        stmt.run(
          item.stock_id,
          item.date,
          item.open,
          item.high,
          item.low,
          item.close,
          item.volume,
          item.trading_money
        );
      } catch (error) {
        console.error(`儲存股價資料失敗:`, error);
      }
    }
  }

  /**
   * 儲存估值資料到資料庫
   */
  private saveValuationData(data: ValuationData[]): void {
    if (data.length === 0) return;

    const db = this.getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO valuations
       (stock_id, date, per, pbr, dividend_yield)
       VALUES (?, ?, ?, ?, ?)`
    );

    for (const item of data) {
      try {
        stmt.run(
          item.stock_id,
          item.date,
          item.per,
          item.pbr,
          item.dividend_yield
        );
      } catch (error) {
        console.error(`儲存估值資料失敗:`, error);
      }
    }
  }

  /**
   * 從資料庫讀取股價資料
   */
  getPriceData(stockId: string, limit: number = 252): PriceData[] {
    const db = this.getDb();
    const stmt = db.prepare(
      `SELECT * FROM stock_prices
       WHERE stock_id = ?
       ORDER BY date DESC
       LIMIT ?`
    );

    return stmt.all(stockId, limit) as PriceData[];
  }

  /**
   * 從資料庫讀取估值資料
   */
  getValuationData(stockId: string, limit: number = 252): ValuationData[] {
    const db = this.getDb();
    const stmt = db.prepare(
      `SELECT * FROM valuations
       WHERE stock_id = ?
       ORDER BY date DESC
       LIMIT ?`
    );

    return stmt.all(stockId, limit) as ValuationData[];
  }

  /**
   * 計算技術指標
   */
  calculateTechnicalIndicators(prices: PriceData[]): {
    ma5: number[];
    ma20: number[];
    ma60: number[];
    rsi: number[];
    macd: number[];
    bbUpper: number[];
    bbMiddle: number[];
    bbLower: number[];
    volatility: number;
  } {
    const closes = prices.map(p => p.close);

    return {
      ma5: this.calculateSMA(closes, 5),
      ma20: this.calculateSMA(closes, 20),
      ma60: this.calculateSMA(closes, 60),
      rsi: this.calculateRSI(closes, 14),
      macd: this.calculateMACD(closes),
      bbUpper: this.calculateBollingerBands(closes, 20).upper,
      bbMiddle: this.calculateBollingerBands(closes, 20).middle,
      bbLower: this.calculateBollingerBands(closes, 20).lower,
      volatility: this.calculateVolatility(closes),
    };
  }

  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // 計算每日漲跌
    for (let i = 1; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousPrice = prices[i - 1];
      if (currentPrice !== undefined && previousPrice !== undefined) {
        const change = currentPrice - previousPrice;
        gains.push(change > 0 ? change : 0);
        losses.push(change < 0 ? Math.abs(change) : 0);
      }
    }

    // 計算 RSI
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousPrice = prices[i - 1];
      if (currentPrice !== undefined && previousPrice !== undefined && previousPrice !== 0) {
        returns.push(Math.log(currentPrice / previousPrice));
      }
    }

    if (returns.length === 0) return 0;

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);

    return Math.sqrt(variance * 252); // 年化波動率
  }

  private calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const ema: number[] = [];
    const k = 2 / (period + 1);

    let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(prev);
    for (let i = period; i < prices.length; i++) {
      const price = prices[i]!;
      prev = price * k + prev * (1 - k);
      ema.push(prev);
    }

    return ema;
  }

  private calculateMACD(prices: number[]): number[] {
    const shortPeriod = 12;
    const longPeriod = 26;
    if (prices.length < longPeriod) return [];

    const emaShort = this.calculateEMA(prices, shortPeriod);
    const emaLong = this.calculateEMA(prices, longPeriod);

    const diff: number[] = [];
    const offset = longPeriod - shortPeriod;
    for (let i = 0; i < emaLong.length; i++) {
      const shortVal = emaShort[i + offset]!;
      const longVal = emaLong[i]!;
      diff.push(shortVal - longVal);
    }

    return diff;
  }

  private calculateBollingerBands(prices: number[], period: number = 20): { upper: number[]; middle: number[]; lower: number[] } {
    if (prices.length < period) return { upper: [], middle: [], lower: [] };

    const middle = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = middle[i - period + 1]!;
      const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + 2 * std);
      lower.push(mean - 2 * std);
    }

    return { upper, middle, lower };
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
