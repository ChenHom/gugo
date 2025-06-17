import { ApiClient } from '../services/apiClient.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { FinMindClient } from '../utils/finmindClient.js';
import { FundFlowData } from '../types/index.js';
import { TWSE_ENDPOINTS } from '../constants/index.js';

export class FundFlowFetcher {
  private apiClient: ApiClient;
  private dbManager: DatabaseManager;
  private finmindClient: FinMindClient;

  constructor(finmindToken?: string) {
    this.apiClient = new ApiClient();
    this.dbManager = new DatabaseManager();
    // 自動從環境變數或傳入參數讀取 token
    this.finmindClient = new FinMindClient(finmindToken);
  }

  async initialize(): Promise<void> {
    await this.dbManager.initialize();
  }

  async fetchFundFlowData(stockNos?: string[]): Promise<FundFlowData[]> {
    try {
      console.log('使用 FinMind API 抓取資金流資料...');

      const targetStocks = stockNos || ['2330', '2454', '2881', '2891']; // 預設股票清單
      const fundFlowData: FundFlowData[] = [];

      // 設定日期範圍（預設最近1年）
      const endDate: string = new Date().toISOString().split('T')[0] || '';
      const startDate: string = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        .toISOString().split('T')[0] || '';

      for (const stockNo of targetStocks.slice(0, 10)) { // 限制數量避免超過速率限制
        try {
          const institutionalData = await this.finmindClient.getInstitutionalInvestors(
            stockNo,
            startDate,
            endDate
          );

          const processedData = this.finmindClient.calculateInstitutionalNetBuy(institutionalData);

          processedData.forEach(item => {
            fundFlowData.push({
              stockNo: stockNo,
              date: item.date,
              foreignNet: item.foreign_net,
              invTrustNet: item.investment_trust_net,
              // holdingRatio 需要其他 API 獲取，先省略
            });
          });

          // 避免速率限制，稍作延遲
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.warn(`Warning: 無法獲取股票 ${stockNo} 的資金流資料:`, (error as Error).message);
          continue;
        }
      }

      // Store in database
      if (fundFlowData.length > 0) {
        await this.saveToDatabase(fundFlowData);
      }

      return fundFlowData;

    } catch (error) {
      await ErrorHandler.logError(error as Error, 'FundFlowFetcher.fetchFundFlowData');
      console.warn('Warning: FinMind 資金流API 失敗，回退到空資料');
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
