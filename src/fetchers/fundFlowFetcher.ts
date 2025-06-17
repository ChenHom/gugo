import { ApiClient } from '../services/apiClient.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { FundFlowData } from '../types/index.js';
import { TWSE_ENDPOINTS } from '../constants/index.js';

export class FundFlowFetcher {
  private apiClient: ApiClient;
  private dbManager: DatabaseManager;

  constructor() {
    this.apiClient = new ApiClient();
    this.dbManager = new DatabaseManager();
  }

  async fetchFundFlowData(): Promise<FundFlowData[]> {
    try {
      console.log('開始抓取資金流資料...');

      // Note: TWSE OpenAPI FUND_FLOW endpoint is currently unavailable (404)
      console.warn('Warning: 資金流API端點目前無法使用，跳過資金流資料抓取');
      return [];

      // TODO: When API is available, implement the following:
      // - 獲取外資買賣超資料
      // - 獲取投信買賣超資料
      // - 獲取法人持股比例資料
      // - 合併資料並儲存到資料庫

    } catch (error) {
      await ErrorHandler.logError(error as Error, 'FundFlowFetcher.fetchFundFlowData');
      console.warn('資金流資料抓取失敗，跳過此模組');
      return [];
    }
  }

  private async fetchForeignData(): Promise<any[]> {
    // 抓取外資買賣超資料
    const endpoint = TWSE_ENDPOINTS.FUND_FLOW;
    const response = await this.apiClient.get(endpoint) as any;

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('外資資料格式錯誤');
    }

    return response.data;
  }

  private async fetchTrustData(): Promise<any[]> {
    // 抓取投信買賣超資料（可能是不同的 endpoint）
    const endpoint = TWSE_ENDPOINTS.FUND_FLOW;
    const response = await this.apiClient.get(endpoint) as any;

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('投信資料格式錯誤');
    }

    return response.data;
  }

  private async fetchHoldingData(): Promise<any[]> {
    // 抓取法人持股比例資料
    const endpoint = TWSE_ENDPOINTS.FUND_FLOW;
    const response = await this.apiClient.get(endpoint) as any;

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('持股比例資料格式錯誤');
    }

    return response.data;
  }

  private mergeFundFlowData(
    foreignData: any[],
    trustData: any[],
    holdingData: any[]
  ): FundFlowData[] {
    const fundFlowData: FundFlowData[] = [];

    // 以股票代號為基準合併資料
    const stockSymbols = new Set([
      ...foreignData.map(f => f.symbol),
      ...trustData.map(t => t.symbol),
      ...holdingData.map(h => h.symbol)
    ]);

    for (const symbol of stockSymbols) {
      const foreign = foreignData.find(f => f.symbol === symbol);
      const trust = trustData.find(t => t.symbol === symbol);
      const holding = holdingData.find(h => h.symbol === symbol);

      fundFlowData.push({
        stockNo: symbol,
        date: new Date().toISOString().slice(0, 10),
        foreignNet: foreign?.netBuySell || 0,
        invTrustNet: trust?.netBuySell || 0,
        holdingRatio: holding?.ratio || 0
      });
    }

    return fundFlowData;
  }

  private async saveToDatabase(fundFlowData: FundFlowData[]): Promise<void> {
    const db = this.dbManager.getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO fund_flow (
        stock_no, date, foreign_net, inv_trust_net, holding_ratio
      ) VALUES (?, ?, ?, ?, ?)
    `);

    for (const data of fundFlowData) {
      stmt.run(
        data.stockNo,
        data.date,
        data.foreignNet,
        data.invTrustNet,
        data.holdingRatio
      );
    }
  }
}
