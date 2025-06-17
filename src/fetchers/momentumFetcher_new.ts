import { FinMindClient, StockPriceData } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface MomentumMetrics {
  stock_id: string;
  date: string;
  ma_5?: number;
  ma_20?: number;
  ma_60?: number;
  rsi?: number;
  macd?: number;
  price_change_1m?: number;
  price_change_3m?: number;
  volume_ratio?: number;
}

/**
 * 動能指標資料擷取器
 * 負責計算和處理技術分析相關指標
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

    // 創建動能指標表
    db.exec(`
      CREATE TABLE IF NOT EXISTS momentum_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        date TEXT NOT NULL,
        ma_5 REAL,
        ma_20 REAL,
        ma_60 REAL,
        rsi REAL,
        macd REAL,
        price_change_1m REAL,
        price_change_3m REAL,
        volume_ratio REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, date)
      )
    `);

    console.log('動能指標資料庫初始化完成');
  }

  /**
   * 抓取並計算動能指標
   */
  async fetchMomentumIndicators(
    stockId: string,
    startDate: string,
    endDate: string
  ): Promise<MomentumMetrics[]> {
    console.log(`📊 抓取動能指標: ${stockId} (${startDate} ~ ${endDate})`);

    try {
      // 擴展開始日期以計算技術指標（需要更多歷史資料）
      const extendedStartDate = this.getExtendedStartDate(startDate, 120); // 往前推120天

      // 抓取股價資料
      const priceData = await this.client.getStockPrice(stockId, extendedStartDate, endDate);

      if (!priceData || priceData.length === 0) {
        console.log(`⚠️  ${stockId} 無股價資料`);
        return [];
      }

      // 計算技術指標
      const momentumMetrics = this.calculateTechnicalIndicators(priceData, startDate);

      // 儲存到資料庫
      await this.saveMomentumMetrics(momentumMetrics);

      console.log(`✅ 成功計算 ${momentumMetrics.length} 個交易日的動能指標`);
      return momentumMetrics;

    } catch (error) {
      console.error(`❌ 抓取 ${stockId} 動能指標失敗:`, error);
      throw error;
    }
  }

  /**
   * 計算技術指標
   */
  private calculateTechnicalIndicators(priceData: StockPriceData[], startDate: string): MomentumMetrics[] {
    const sortedData = priceData.sort((a, b) => a.date.localeCompare(b.date));
    const metrics: MomentumMetrics[] = [];

    for (let i = 0; i < sortedData.length; i++) {
      const current = sortedData[i];

      // 只計算 startDate 之後的資料
      if (current.date < startDate) continue;

      const metric: MomentumMetrics = {
        stock_id: current.stock_id,
        date: current.date,
      };

      // 計算移動平均線
      metric.ma_5 = this.calculateMovingAverage(sortedData, i, 5);
      metric.ma_20 = this.calculateMovingAverage(sortedData, i, 20);
      metric.ma_60 = this.calculateMovingAverage(sortedData, i, 60);

      // 計算 RSI
      metric.rsi = this.calculateRSI(sortedData, i, 14);

      // 計算價格變化率
      metric.price_change_1m = this.calculatePriceChange(sortedData, i, 20); // 約1個月
      metric.price_change_3m = this.calculatePriceChange(sortedData, i, 60); // 約3個月

      // 計算成交量比率
      metric.volume_ratio = this.calculateVolumeRatio(sortedData, i, 20);

      metrics.push(metric);
    }

    return metrics;
  }

  /**
   * 計算移動平均線
   */
  private calculateMovingAverage(data: StockPriceData[], currentIndex: number, period: number): number | undefined {
    if (currentIndex < period - 1) return undefined;

    let sum = 0;
    for (let i = currentIndex - period + 1; i <= currentIndex; i++) {
      sum += data[i].close;
    }
    return sum / period;
  }

  /**
   * 計算 RSI
   */
  private calculateRSI(data: StockPriceData[], currentIndex: number, period: number): number | undefined {
    if (currentIndex < period) return undefined;

    let gains = 0;
    let losses = 0;

    for (let i = currentIndex - period + 1; i <= currentIndex; i++) {
      const change = data[i].close - data[i - 1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;

    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * 計算價格變化率
   */
  private calculatePriceChange(data: StockPriceData[], currentIndex: number, period: number): number | undefined {
    if (currentIndex < period) return undefined;

    const currentPrice = data[currentIndex].close;
    const pastPrice = data[currentIndex - period].close;

    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  /**
   * 計算成交量比率
   */
  private calculateVolumeRatio(data: StockPriceData[], currentIndex: number, period: number): number | undefined {
    if (currentIndex < period - 1) return undefined;

    let sumVolume = 0;
    for (let i = currentIndex - period + 1; i <= currentIndex; i++) {
      sumVolume += data[i].Trading_Volume;
    }
    const avgVolume = sumVolume / period;

    return avgVolume > 0 ? data[currentIndex].Trading_Volume / avgVolume : undefined;
  }

  /**
   * 取得擴展的開始日期
   */
  private getExtendedStartDate(startDate: string, daysToSubtract: number): string {
    const date = new Date(startDate);
    date.setDate(date.getDate() - daysToSubtract);
    return date.toISOString().split('T')[0];
  }

  /**
   * 儲存動能指標到資料庫
   */
  private async saveMomentumMetrics(metrics: MomentumMetrics[]): Promise<void> {
    const db = this.getDb();
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO momentum_metrics
      (stock_id, date, ma_5, ma_20, ma_60, rsi, macd, price_change_1m, price_change_3m, volume_ratio)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((metricsArray: MomentumMetrics[]) => {
      for (const metric of metricsArray) {
        insertStmt.run(
          metric.stock_id,
          metric.date,
          metric.ma_5 || null,
          metric.ma_20 || null,
          metric.ma_60 || null,
          metric.rsi || null,
          metric.macd || null,
          metric.price_change_1m || null,
          metric.price_change_3m || null,
          metric.volume_ratio || null
        );
      }
    });

    transaction(metrics);
  }

  /**
   * 從資料庫取得動能指標
   */
  getMomentumMetrics(stockId: string, startDate?: string, endDate?: string): MomentumMetrics[] {
    const db = this.getDb();
    let query = 'SELECT * FROM momentum_metrics WHERE stock_id = ?';
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
    return stmt.all(...params) as MomentumMetrics[];
  }

  /**
   * 向後相容的方法，供舊版 CLI 使用
   */
  async fetchMomentumData(stockId: string, startDate: string, endDate: string): Promise<MomentumMetrics[]> {
    return this.fetchMomentumIndicators(stockId, startDate, endDate);
  }

  /**
   * 批次抓取多個股票的動能指標
   */
  async fetchMultipleStocks(
    stockIds: string[],
    startDate: string,
    endDate: string
  ): Promise<Map<string, MomentumMetrics[]>> {
    const results = new Map<string, MomentumMetrics[]>();

    for (const stockId of stockIds) {
      try {
        const metrics = await this.fetchMomentumIndicators(stockId, startDate, endDate);
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
