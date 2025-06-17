import { ApiClient } from '../services/apiClient.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { API_ENDPOINTS, CACHE_CONFIG } from '../constants/index.js';
import { GrowthData, FetchOptions, ApiResponse } from '../types/index.js';

export class GrowthFetcher {
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

  async fetchRevenueData(options: FetchOptions = {}): Promise<ApiResponse<GrowthData>> {
    try {
      const rawData = await this.apiClient.get<any[]>(
        API_ENDPOINTS.GROWTH_REVENUE,
        {},
        options.useCache ?? true,
        CACHE_CONFIG.EXPIRY.MONTHLY
      );

      const growthData = this.parseRevenueData(rawData);

      // Filter by specific stock codes if provided
      const filteredData = options.stockNos
        ? growthData.filter(item => options.stockNos!.includes(item.stockNo))
        : growthData;

      // Store in database
      await this.storeGrowthData(filteredData);

      return {
        success: true,
        data: filteredData,
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'GrowthFetcher.fetchRevenueData');
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async fetchEpsData(options: FetchOptions = {}): Promise<ApiResponse<GrowthData>> {
    try {
      // Note: TWSE OpenAPI EPS endpoint is currently unavailable (returns HTML)
      console.warn('Warning: EPS API端點目前無法使用，跳過EPS資料抓取');

      return {
        success: true,
        data: [],
      };

      // TODO: When API is available, implement proper EPS data fetching
      /*
      const rawData = await this.apiClient.get<any[]>(
        API_ENDPOINTS.GROWTH_EPS,
        {},
        options.useCache ?? true,
        CACHE_CONFIG.EXPIRY.MONTHLY
      );

      const growthData = this.parseEpsData(rawData);

      // Filter by specific stock codes if provided
      const filteredData = options.stockNos
        ? growthData.filter(item => options.stockNos!.includes(item.stockNo))
        : growthData;

      // Store in database (merge with existing revenue data)
      await this.mergeEpsData(filteredData);

      return {
        success: true,
        data: filteredData,
      };
      */
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'GrowthFetcher.fetchEpsData');
      return {
        success: true, // Don't fail the entire process
        data: [],
      };
    }
  }

  private parseRevenueData(rawData: any[]): GrowthData[] {
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid API response format');
    }

    // Check if data contains company basic info (t187ap03_L) instead of revenue data
    if (rawData.length > 0 && rawData[0]['公司名稱'] && !rawData[0]['當月營收']) {
      console.warn('Warning: API endpoint returns company basic info, not monthly revenue data. No revenue data available.');
      return [];
    }

    return rawData
      .filter(row => row && typeof row === 'object')
      .map(row => {
        const stockNo = String(row['公司代號'] || '').trim();
        const yearMonth = String(row['年月'] || '').trim();
        const revenue = this.parseNumber(row['當月營收']);
        const yoy = this.parseNumber(row['去年同月增減(％)']);
        const mom = this.parseNumber(row['上月比較增減(％)']);

        if (!stockNo || !yearMonth || !/^\d{4}$/.test(stockNo)) {
          return null;
        }

        // Convert YYYYMM to YYYY-MM-01 format
        const year = yearMonth.substring(0, 4);
        const month = yearMonth.substring(4, 6);
        const monthDate = `${year}-${month}-01`;

        return {
          stockNo,
          date: monthDate,
          month: monthDate,
          revenue,
          yoy,
          mom,
        } as GrowthData;
      })
      .filter((item): item is GrowthData => item !== null) as GrowthData[];
  }

  private parseEpsData(rawData: any[]): GrowthData[] {
    if (!Array.isArray(rawData)) {
      throw new Error('Invalid API response format');
    }

    return rawData
      .filter(row => row && typeof row === 'object')
      .map(row => {
        const stockNo = String(row['公司代號'] || '').trim();
        const eps = this.parseNumber(row['基本每股盈餘(元)']);
        const quarter = String(row['季別'] || '').trim();

        if (!stockNo || !quarter || !/^\d{4}$/.test(stockNo)) {
          return null;
        }

        // Convert quarter to month format (Q1->03, Q2->06, Q3->09, Q4->12)
        const year = quarter.substring(0, 4);
        const q = quarter.substring(4);
        const monthMap: Record<string, string> = { '1': '03', '2': '06', '3': '09', '4': '12' };
        const month = monthMap[q] || '12';
        const monthDate = `${year}-${month}-01`;

        return {
          stockNo,
          date: monthDate,
          month: monthDate,
          eps,
        } as GrowthData;
      })
      .filter((item): item is GrowthData => item !== null) as GrowthData[];
  }

  private parseNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value === '-' || value === 'N/A') return undefined;

    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  private async storeGrowthData(data: GrowthData[]): Promise<void> {
    for (const item of data) {
      await this.dbManager.upsertGrowth({
        stockNo: item.stockNo,
        month: item.month,
        revenue: item.revenue,
        yoy: item.yoy,
        mom: item.mom,
        eps: item.eps,
        epsQoQ: item.epsQoQ,
      });
    }
  }

  private async mergeEpsData(epsData: GrowthData[]): Promise<void> {
    for (const item of epsData) {
      // Get existing record to preserve revenue data
      const existing = await this.dbManager.getGrowthData(item.stockNo, item.month);
      const existingRecord = existing[0];

      await this.dbManager.upsertGrowth({
        stockNo: item.stockNo,
        month: item.month,
        revenue: existingRecord?.revenue,
        yoy: existingRecord?.yoy,
        mom: existingRecord?.mom,
        eps: item.eps,
        epsQoQ: item.epsQoQ,
      });
    }
  }

  async getStoredGrowthData(stockNo?: string, month?: string): Promise<GrowthData[]> {
    try {
      const rawData = await this.dbManager.getGrowthData(stockNo, month);
      return rawData.map(row => ({
        stockNo: row.stock_no,
        date: row.month,
        month: row.month,
        revenue: row.revenue,
        yoy: row.yoy,
        mom: row.mom,
        eps: row.eps,
        epsQoQ: row.eps_qoq,
      }));
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'GrowthFetcher.getStoredGrowthData');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }
}
