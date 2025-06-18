import { FinMindClient } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface MomentumMetrics {
  stock_id: string;
  date: string;
  rsi?: number;
  ma_5?: number;
  ma_20?: number;
  ma_60?: number;
  macd?: number;
  boll_upper?: number;
  boll_middle?: number;
  boll_lower?: number;
  price_change_1m?: number;
}

/**
 * 動能指標資料擷取器
 * 負責抓取和處理技術指標資料
 */
export class MomentumFetcher {
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

    // 創建技術指標表
    db.exec(`
      CREATE TABLE IF NOT EXISTS technical_indicators (
        stock_no TEXT NOT NULL,
        date DATE NOT NULL,
        ma_5 REAL,
        ma_20 REAL,
        ma_60 REAL,
        rsi REAL,
        macd REAL,
        bb_upper REAL,
        bb_middle REAL,
        bb_lower REAL,
        PRIMARY KEY (stock_no, date)
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
  async fetchMomentumData(stockIds: string[], days: number = 60): Promise<MomentumMetrics[]> {
    try {
      console.log(`開始抓取 ${stockIds.length} 支股票的動能資料...`);

      const allMetrics: MomentumMetrics[] = [];
      const endDate: string = new Date().toISOString().split('T')[0]!;
      const startDate: string = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      for (const stockId of stockIds) {
        try {
          console.log(`處理股票 ${stockId}...`);

          // 從 FinMind API 獲取股價資料
          const priceData = await this.client.getStockPrice(stockId, startDate, endDate!);

          if (!priceData || priceData.length === 0) {
            console.log(`⚠️  ${stockId} 無股價資料`);
            continue;
          }

          // 排序並計算技術指標
          const sortedData = priceData.sort((a, b) => a.date.localeCompare(b.date));
          const closePrices = sortedData.map(d => d.close);

          // 計算技術指標
          const rsi = this.calculateRSI(closePrices);
          const ma5 = this.calculateSMA(closePrices, 5);
          const ma20 = this.calculateSMA(closePrices, 20);
          const ma60 = this.calculateSMA(closePrices, 60);
          const macd = this.calculateMACD(closePrices);
          const bb = this.calculateBollingerBands(closePrices, 20);

          // 計算最新的指標值
          const latestData = sortedData[sortedData.length - 1];
          if (!latestData) continue;

          const latestDate = latestData.date;
          const latestRSI = rsi.length > 0 ? rsi[rsi.length - 1] : undefined;
          const latestMA5 = ma5.length > 0 ? ma5[ma5.length - 1] : undefined;
          const latestMA20 = ma20.length > 0 ? ma20[ma20.length - 1] : undefined;
          const latestMA60 = ma60.length > 0 ? ma60[ma60.length - 1] : undefined;
          const latestMACD = macd.length > 0 ? macd[macd.length - 1] : undefined;
          const latestBBUpper = bb.upper.length > 0 ? bb.upper[bb.upper.length - 1] : undefined;
          const latestBBMiddle = bb.middle.length > 0 ? bb.middle[bb.middle.length - 1] : undefined;
          const latestBBLower = bb.lower.length > 0 ? bb.lower[bb.lower.length - 1] : undefined;

          // 計算一個月價格變化率
          const priceChange1M = this.calculatePriceChange(closePrices, 22); // 約22個交易日為一個月

          const metrics: MomentumMetrics = {
            stock_id: stockId,
            date: latestDate,
            ...(latestRSI !== undefined && { rsi: latestRSI }),
            ...(latestMA5 !== undefined && { ma_5: latestMA5 }),
            ...(latestMA20 !== undefined && { ma_20: latestMA20 }),
            ...(latestMA60 !== undefined && { ma_60: latestMA60 }),
            ...(latestMACD !== undefined && { macd: latestMACD }),
            ...(latestBBUpper !== undefined && { boll_upper: latestBBUpper }),
            ...(latestBBMiddle !== undefined && { boll_middle: latestBBMiddle }),
            ...(latestBBLower !== undefined && { boll_lower: latestBBLower }),
            ...(priceChange1M !== undefined && { price_change_1m: priceChange1M })
          };

          allMetrics.push(metrics);
          console.log(`✅ ${stockId} 動能指標計算完成: RSI=${latestRSI?.toFixed(2)}, MA20=${latestMA20?.toFixed(2)}, 月變化=${priceChange1M?.toFixed(2)}%`);

        } catch (error) {
          console.error(`❌ ${stockId} 動能指標計算失敗:`, error);
        }
      }

      // 儲存到資料庫
      this.saveMomentumData(allMetrics);

      console.log(`✅ 成功抓取 ${allMetrics.length} 筆動能指標資料`);
      return allMetrics;

    } catch (error) {
      console.error('❌ 動能資料抓取失敗:', error);
      return [];
    }
  }

  /**
   * 計算 RSI (相對強弱指數)
   */
  private calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) return [];

    const gains: number[] = [];
    const losses: number[] = [];
    const rsi: number[] = [];

    // 計算價格變化
    for (let i = 1; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousPrice = prices[i - 1];

      if (currentPrice === undefined || previousPrice === undefined) continue;

      const change = currentPrice - previousPrice;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
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

  /**
   * 計算簡單移動平均線 (SMA)
   */
  private calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    return sma;
  }

  /**
   * 計算價格變化率
   */
  private calculatePriceChange(prices: number[], period: number): number | undefined {
    if (prices.length < period + 1) return undefined;

    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - period - 1];

    if (currentPrice === undefined || pastPrice === undefined || pastPrice === 0) {
      return undefined;
    }

    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  /**
   * 計算指數移動平均線 (EMA)
   */
  private calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];

    const ema: number[] = [];
    const k = 2 / (period + 1);

    let prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(prev);
    for (let i = period; i < prices.length; i++) {
      const price = prices[i];
      prev = price * k + prev * (1 - k);
      ema.push(prev);
    }

    return ema;
  }

  /**
   * 計算 MACD (EMA12 - EMA26)
   */
  private calculateMACD(prices: number[]): number[] {
    const shortPeriod = 12;
    const longPeriod = 26;
    if (prices.length < longPeriod) return [];

    const emaShort = this.calculateEMA(prices, shortPeriod);
    const emaLong = this.calculateEMA(prices, longPeriod);

    const diff: number[] = [];
    const offset = longPeriod - shortPeriod;
    for (let i = 0; i < emaLong.length; i++) {
      const shortVal = emaShort[i + offset];
      const longVal = emaLong[i];
      diff.push(shortVal - longVal);
    }

    return diff;
  }

  /**
   * 計算布林通道
   */
  private calculateBollingerBands(prices: number[], period: number = 20): { upper: number[]; middle: number[]; lower: number[] } {
    if (prices.length < period) return { upper: [], middle: [], lower: [] };

    const middle = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = middle[i - period + 1];
      const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + 2 * std);
      lower.push(mean - 2 * std);
    }

    return { upper, middle, lower };
  }

  /**
   * 儲存動能指標資料到資料庫
   */
  private saveMomentumData(data: MomentumMetrics[]): void {
    if (data.length === 0) return;

    const db = this.getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO technical_indicators
       (stock_no, date, ma_5, ma_20, ma_60, rsi, macd, bb_upper, bb_middle, bb_lower, price_change_1m)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of data) {
      try {
        stmt.run(
          item.stock_id,
          item.date,
          item.ma_5 || null,
          item.ma_20 || null,
          item.ma_60 || null,
          item.rsi || null,
          item.macd || null,
          item.boll_upper || null,
          item.boll_middle || null,
          item.boll_lower || null,
          item.price_change_1m || null
        );
      } catch (error) {
        console.error(`儲存動能指標資料失敗:`, error);
      }
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
