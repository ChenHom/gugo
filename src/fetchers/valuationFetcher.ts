import { ApiClient } from '../services/apiClient.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { API_ENDPOINTS, CACHE_CONFIG } from '../constants/index.js';
import { ValuationData, FetchOptions, ApiResponse } from '../types/index.js';

export class ValuationFetcher {
  private apiClient: ApiClient;
  private dbManager: DatabaseManager;

  constructor() {
    this.apiClient = new ApiClient();
    this.dbManager = new DatabaseManager();
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.apiClient.initialize(),
      this.dbManager.initialize(),
    ]);
  }

  async fetchValuationData(options: FetchOptions = {}): Promise<ApiResponse<ValuationData>> {
    try {
      const date = options.date || this.getCurrentDate();
      const params = {
        response: 'open_data',
        date: date.replace(/-/g, ''),
      };

      const rawData = await this.apiClient.get<any[]>(
        API_ENDPOINTS.VALUATION,
        params,
        options.useCache ?? true,
        CACHE_CONFIG.EXPIRY.DAILY
      );

      const valuationData = this.parseValuationData(rawData, date);

      // Filter by specific stock codes if provided
      const filteredData = options.stockNos
        ? valuationData.filter(item => options.stockNos!.includes(item.stockNo))
        : valuationData;

      // Store in database
      await this.storeValuationData(filteredData);

      return {
        success: true,
        data: filteredData,
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'ValuationFetcher.fetchValuationData');
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  private parseValuationData(rawData: any[], date: string): ValuationData[] {
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid API response format');
    }

    return rawData
      .filter(item => item && typeof item === 'object' && item.Code)
      .map(item => {
        const stockNo = String(item.Code).trim();
        const per = this.parseNumber(item.PEratio);
        const pbr = this.parseNumber(item.PBratio);
        const dividendYield = this.parseNumber(item.DividendYield);

        return {
          stockNo,
          date,
          per,
          pbr,
          dividendYield,
        };
      })
      .filter(item => item.stockNo && /^\d{4}$/.test(item.stockNo)); // Filter valid stock codes
  }

  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value === '-' || value === 'N/A') return undefined;

    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private async storeValuationData(data: ValuationData[]): Promise<void> {
    for (const item of data) {
      await this.dbManager.upsertValuation({
        stockNo: item.stockNo,
        date: item.date,
        per: item.per,
        pbr: item.pbr,
        dividendYield: item.dividendYield,
      });
    }
  }

  private getCurrentDate(): string {
    return new Date().toISOString().split('T')[0]!;
  }

  async getStoredValuationData(stockNo?: string, date?: string): Promise<ValuationData[]> {
    try {
      const rawData = await this.dbManager.getValuationData(stockNo, date);
      return rawData.map(row => ({
        stockNo: row.stock_no,
        date: row.date,
        per: row.per,
        pbr: row.pbr,
        dividendYield: row.dividend_yield,
      }));
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'ValuationFetcher.getStoredValuationData');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }
}
