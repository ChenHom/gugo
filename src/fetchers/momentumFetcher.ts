import { FinMindClient } from '../utils/finmindClient.js';
import { TWSeApiClient } from '../utils/twseApiClient.js';
import { DataFetchStrategy } from '../utils/dataFetchStrategy.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface MomentumMetrics {
  stock_no: string;
  date: string;
  rsi?: number;
  ma_5?: number;
  ma_20?: number;
  ma_60?: number;
  macd?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  price_change_1m?: number;
  relative_strength_52w?: number;
  ma20_above_ma60_days?: number;
}

/**
 * 動能指標資料擷取器
 * 負責抓取和處理技術指標資料
 * 支援 TWSE OpenAPI 優先、FinMind 備用的策略
 */
export class MomentumFetcher {
  private finmindClient: FinMindClient;
  private twseClient: TWSeApiClient;
  private strategy: DataFetchStrategy;
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(finmindToken?: string, dbPath: string = 'data/fundamentals.db') {
    this.finmindClient = new FinMindClient(finmindToken);
    this.twseClient = new TWSeApiClient();
    this.strategy = new DataFetchStrategy(finmindToken);
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
        price_change_1m REAL,
        relative_strength_52w REAL,
        ma20_above_ma60_days INTEGER,
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
   * 改進：確保即使部分股票無法取得資料，也會返回與輸入股票數量相等的結果數組
   */
  async fetchMomentumData(stockIds: string[], days: number = 60): Promise<MomentumMetrics[]> {
    try {
      if (process.env.DEBUG) {
        console.log(`開始抓取 ${stockIds.length} 支股票的動能資料...`);
      }

      const allMetrics: MomentumMetrics[] = [];
      const endDate: string = new Date().toISOString().split('T')[0]!;
      const startDate: string = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

      // 為所有股票預先創建基本資料結構（確保即使資料抓取失敗，也能返回結果）
      const metricsMap = new Map<string, MomentumMetrics>();
      for (const stockId of stockIds) {
        metricsMap.set(stockId, {
          stock_no: stockId,
          date: endDate,  // 預設使用今天的日期
        });
      }

      for (const stockId of stockIds) {
        try {
          if (process.env.DEBUG) {
            console.log(`處理股票 ${stockId}...`);
          }

          // 直接使用 FinMind 獲取股價資料
          let priceData;
          try {
            priceData = await this.finmindClient.getStockPrice(stockId, startDate, endDate!);
            if (process.env.DEBUG && priceData && priceData.length > 0) {
              console.log(`✅ 成功從 FinMind 獲取 ${stockId} 股價資料: ${priceData.length} 筆`);
            }
          } catch (error) {
            if (process.env.DEBUG) {
              console.warn(`⚠️ FinMind 股價資料獲取失敗: ${error instanceof Error ? error.message : error}`);
            }
            priceData = null;
          }

          // 如果無法獲取資料
          if (!priceData || priceData.length === 0) {
            if (process.env.DEBUG) {
              console.log(`⚠️ ${stockId} 無法獲取股價資料`);
            }
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
          const rs52w = this.calculatePriceChange(closePrices, 252);
          const ma20AboveDays = this.countMA20AboveMA60Days(closePrices);

          const metrics: MomentumMetrics = {
            stock_no: stockId,
            date: latestDate,
            ...(latestRSI !== undefined && { rsi: latestRSI }),
            ...(latestMA5 !== undefined && { ma_5: latestMA5 }),
            ...(latestMA20 !== undefined && { ma_20: latestMA20 }),
            ...(latestMA60 !== undefined && { ma_60: latestMA60 }),
            ...(latestMACD !== undefined && { macd: latestMACD }),
            ...(latestBBUpper !== undefined && { bb_upper: latestBBUpper }),
            ...(latestBBMiddle !== undefined && { bb_middle: latestBBMiddle }),
            ...(latestBBLower !== undefined && { bb_lower: latestBBLower }),
            ...(priceChange1M !== undefined && { price_change_1m: priceChange1M }),
            ...(rs52w !== undefined && { relative_strength_52w: rs52w }),
            ma20_above_ma60_days: ma20AboveDays
          };

          // 更新 Map 中的資料
          metricsMap.set(stockId, metrics);
          
          if (process.env.DEBUG) {
            console.log(`✅ ${stockId} 動能指標計算完成: RSI=${latestRSI?.toFixed(2)}, MA20=${latestMA20?.toFixed(2)}, 月變化=${priceChange1M?.toFixed(2)}%`);
          }

        } catch (error) {
          console.error(`❌ ${stockId} 動能指標計算失敗:`, error);
        }
      }

      // 從 Map 收集所有結果
      const result: MomentumMetrics[] = Array.from(metricsMap.values());

      // 儲存到資料庫 (只儲存有完整資料的結果)
      const validMetrics = result.filter(m => m.rsi !== undefined);
      if (validMetrics.length > 0) {
        this.saveMomentumData(validMetrics);
      }

      if (process.env.DEBUG) {
        console.log(`✅ 成功處理 ${result.length} 支股票的動能指標資料`);
      }
      
      return result;

    } catch (error) {
      console.error('❌ 動能資料抓取失敗:', error);

      // 即使發生錯誤，也返回與輸入股票數量相等的結果陣列
      const today = new Date().toISOString().split('T')[0];
      return stockIds.map(stockId => ({
        stock_no: stockId,
        date: today as string
      }));
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
   * 計算在指定價格序列中 MA20 高於 MA60 的天數
   */
  private countMA20AboveMA60Days(prices: number[]): number {
    const ma20 = this.calculateSMA(prices, 20);
    const ma60 = this.calculateSMA(prices, 60);
    let count = 0;
    for (let i = 0; i < prices.length; i++) {
      const ma20Val = i >= 19 ? ma20[i - 19] : undefined;
      const ma60Val = i >= 59 ? ma60[i - 59] : undefined;
      if (ma20Val !== undefined && ma60Val !== undefined && ma20Val > ma60Val) {
        count++;
      }
    }
    return count;
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
      const price = prices[i]!;
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
      const shortVal = emaShort[i + offset]!;
      const longVal = emaLong[i]!;
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
      const mean = middle[i - period + 1]!;
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
      `INSERT OR REPLACE INTO momentum_metrics
       (stock_no, date, ma_5, ma_20, ma_60, rsi, macd, bb_upper, bb_middle, bb_lower, price_change_1m, relative_strength_52w, ma20_above_ma60_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of data) {
      try {
        stmt.run(
          item.stock_no,
          item.date,
          item.ma_5 || null,
          item.ma_20 || null,
          item.ma_60 || null,
          item.rsi || null,
          item.macd || null,
          item.bb_upper || null,
          item.bb_middle || null,
          item.bb_lower || null,
          item.price_change_1m || null,
          item.relative_strength_52w || null,
          item.ma20_above_ma60_days ?? null
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
