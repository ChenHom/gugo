import { ApiClient } from '../services/apiClient.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { PriceData } from '../types/index.js';
import { TWSE_ENDPOINTS } from '../constants/index.js';

interface MomentumData {
  stockNo: string;
  date: string;
  rsi: number;
  ma5: number;
  ma20: number;
  ma60: number;
  priceChange1M: number;
  priceChange3M: number;
  priceChange6M: number;
  volumeRatio: number;
}

export class MomentumFetcher {
  private apiClient: ApiClient;
  private dbManager: DatabaseManager;

  constructor() {
    this.apiClient = new ApiClient();
    this.dbManager = new DatabaseManager();
  }

  async fetchMomentumData(): Promise<MomentumData[]> {
    try {
      console.log('開始抓取動能資料...');

      // 獲取股價資料
      const priceData = await this.fetchPriceData();

      if (priceData.length === 0) {
        console.warn('Warning: 無法獲取價格資料，跳過動能指標計算');
        return [];
      }

      // 計算技術指標
      const momentumData = this.calculateMomentumIndicators(priceData);

      // 儲存到資料庫
      await this.saveToDatabase(momentumData);

      console.log(`成功抓取 ${momentumData.length} 筆動能資料`);
      return momentumData;
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'MomentumFetcher.fetchMomentumData');
      console.warn('動能資料抓取失敗，跳過此模組');
      return [];
    }
  }

  private async fetchPriceData(): Promise<PriceData[]> {
    const endpoint = TWSE_ENDPOINTS.PRICE;

    try {
      const response = await this.apiClient.get(endpoint) as any;

      // Check if response is in expected format
      if (!response || (!response.data && !Array.isArray(response))) {
        console.warn('Warning: 股價API回傳格式不如預期，無法獲取價格資料');
        return [];
      }

      const data = response.data || response;

      if (!Array.isArray(data)) {
        console.warn('Warning: 股價資料不是陣列格式');
        return [];
      }

      return data.map((item: any) => ({
        stockNo: item.Code || item['證券代號'],
        date: item.Date || item['日期'],
        close: parseFloat(item.Close || item['收盤價']) || 0,
        volume: parseInt(item.Volume || item['成交股數']) || 0
      })).filter(item => item.stockNo && item.date);

    } catch (error) {
      console.warn('Warning: 無法連接到股價API，跳過價格資料抓取');
      return [];
    }
  }

  private calculateMomentumIndicators(priceData: PriceData[]): MomentumData[] {
    const momentumData: MomentumData[] = [];

    // 按股票代號分組
    const stockGroups = this.groupByStock(priceData);

    for (const [stockNo, prices] of stockGroups.entries()) {
      // 按日期排序
      const sortedPrices = prices.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      if (sortedPrices.length < 60) continue; // 需要至少60個交易日的資料

      const latestPrice = sortedPrices[sortedPrices.length - 1];
      if (!latestPrice) continue;

      const rsi = this.calculateRSI(sortedPrices, 14);
      const ma5 = this.calculateMA(sortedPrices, 5);
      const ma20 = this.calculateMA(sortedPrices, 20);
      const ma60 = this.calculateMA(sortedPrices, 60);

      // 計算價格變化率
      const priceChange1M = this.calculatePriceChange(sortedPrices, 20); // 約1個月
      const priceChange3M = this.calculatePriceChange(sortedPrices, 60); // 約3個月
      const priceChange6M = this.calculatePriceChange(sortedPrices, 120); // 約6個月

      // 計算成交量比率
      const volumeRatio = this.calculateVolumeRatio(sortedPrices, 20);

      momentumData.push({
        stockNo,
        date: latestPrice.date,
        rsi,
        ma5,
        ma20,
        ma60,
        priceChange1M,
        priceChange3M,
        priceChange6M,
        volumeRatio
      });
    }

    return momentumData;
  }

  private groupByStock(priceData: PriceData[]): Map<string, PriceData[]> {
    const groups = new Map<string, PriceData[]>();

    for (const price of priceData) {
      if (!groups.has(price.stockNo)) {
        groups.set(price.stockNo, []);
      }
      groups.get(price.stockNo)!.push(price);
    }

    return groups;
  }

  private calculateRSI(prices: PriceData[], period: number): number {
    if (prices.length < period + 1) return 50; // 預設值

    let gains = 0;
    let losses = 0;

    for (let i = prices.length - period; i < prices.length; i++) {
      const currentPrice = prices[i];
      const previousPrice = prices[i - 1];
      if (!currentPrice || !previousPrice) continue;

      const change = (currentPrice.close || 0) - (previousPrice.close || 0);
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

  private calculateMA(prices: PriceData[], period: number): number {
    if (prices.length < period) return 0;

    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((total, price) => total + (price.close || 0), 0);
    return sum / period;
  }

  private calculatePriceChange(prices: PriceData[], daysAgo: number): number {
    if (prices.length < daysAgo + 1) return 0;

    const currentPrice = prices[prices.length - 1]?.close || 0;
    const pastPrice = prices[prices.length - 1 - daysAgo]?.close || 0;

    if (pastPrice === 0) return 0;

    return ((currentPrice - pastPrice) / pastPrice) * 100;
  }

  private calculateVolumeRatio(prices: PriceData[], period: number): number {
    if (prices.length < period + 1) return 1;

    const currentVolume = prices[prices.length - 1]?.volume || 0;
    const recentVolumes = prices.slice(-period);
    const avgVolume = recentVolumes.reduce((total, price) => total + (price.volume || 0), 0) / period;

    if (avgVolume === 0) return 1;

    return currentVolume / avgVolume;
  }

  private async saveToDatabase(momentumData: MomentumData[]): Promise<void> {
    const db = this.dbManager.getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO momentum (
        stock_no, date, rsi, ma5, ma20, ma60,
        price_change_1m, price_change_3m, price_change_6m, volume_ratio
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const data of momentumData) {
      stmt.run(
        data.stockNo,
        data.date,
        data.rsi,
        data.ma5,
        data.ma20,
        data.ma60,
        data.priceChange1M,
        data.priceChange3M,
        data.priceChange6M,
        data.volumeRatio
      );
    }
  }
}
