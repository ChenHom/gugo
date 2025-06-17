import { ApiClient } from '../services/apiClient.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { QualityData, CompanyInfo } from '../types/index.js';
import { TWSE_ENDPOINTS } from '../constants/index.js';

export class QualityFetcher {
  private apiClient: ApiClient;
  private dbManager: DatabaseManager;

  constructor() {
    this.apiClient = new ApiClient();
    this.dbManager = new DatabaseManager();
  }

  async fetchQualityData(): Promise<QualityData[]> {
    try {
      console.log('開始抓取品質資料...');

      // Note: TWSE OpenAPI quality endpoints may not have the expected format
      console.warn('Warning: 品質資料API端點格式可能不完整，跳過品質資料抓取');
      return [];

      // TODO: When proper API endpoints are available, implement:
      // - 獲取公司基本資訊
      // - 獲取財務資料
      // - 合併資料並儲存到資料庫

    } catch (error) {
      await ErrorHandler.logError(error as Error, 'QualityFetcher.fetchQualityData');
      console.warn('品質資料抓取失敗，跳過此模組');
      return [];
    }
  }

  private async fetchCompanyInfo(): Promise<CompanyInfo[]> {
    const endpoint = TWSE_ENDPOINTS.COMPANY_INFO;
    const response = await this.apiClient.get(endpoint) as any[];

    // Check if response is array (new JSON format)
    if (!Array.isArray(response)) {
      throw new Error('公司資訊格式錯誤: API回傳格式不正確');
    }

    // Check if data contains expected company fields
    if (response.length > 0 && !response[0]['公司代號']) {
      console.warn('Warning: API回傳資料格式與預期不符，跳過品質資料抓取');
      return [];
    }

    return response.map((item: any) => ({
      symbol: item['公司代號'] || item.Code,
      name: item['公司名稱'] || item.Name,
      market: item.Market,
      industry: item.Industry,
      listingDate: item.ListingDate
    }));
  }

  private async fetchFinancialData(): Promise<any[]> {
    // 這裡會抓取資產品質相關的財務資料
    // 包括資產負債表、現金流量表等
    const endpoint = TWSE_ENDPOINTS.FINANCIAL_STATEMENTS;
    const response = await this.apiClient.get(endpoint) as any;

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error('財務資料格式錯誤');
    }

    return response.data;
  }

  private mergeQualityData(companyInfo: CompanyInfo[], financialData: any[]): QualityData[] {
    const qualityData: QualityData[] = [];

    for (const company of companyInfo) {
      const financial = financialData.find(f => f.symbol === company.symbol);
      if (!financial) continue;

      // 計算品質指標
      const qualityMetrics = this.calculateQualityMetrics(financial);

      qualityData.push({
        symbol: company.symbol,
        name: company.name,
        ...qualityMetrics,
        fetchedAt: new Date()
      });
    }

    return qualityData;
  }

  private calculateQualityMetrics(financial: any): Omit<QualityData, 'symbol' | 'name' | 'fetchedAt'> {
    // 計算品質相關指標
    const totalAssets = financial.totalAssets || 0;
    const totalLiabilities = financial.totalLiabilities || 0;
    const totalEquity = financial.totalEquity || 0;
    const longTermDebt = financial.longTermDebt || 0;
    const currentRatio = financial.currentAssets / (financial.currentLiabilities || 1);
    const quickRatio = (financial.currentAssets - financial.inventory) / (financial.currentLiabilities || 1);
    const operatingCashFlow = financial.operatingCashFlow || 0;
    const netIncome = financial.netIncome || 0;

    return {
      // 負債比率 (越低越好)
      debtToEquity: totalLiabilities / (totalEquity || 1),

      // 流動比率 (>1.5 較佳)
      currentRatio: currentRatio,

      // 速動比率 (>1.0 較佳)
      quickRatio: quickRatio,

      // 長期負債比率 (越低越好)
      longTermDebtRatio: longTermDebt / (totalAssets || 1),

      // 營運現金流量對淨利比 (>1.2 較佳)
      operatingCashFlowToNetIncome: operatingCashFlow / (netIncome || 1),

      // 資產報酬率 (越高越好)
      returnOnAssets: netIncome / (totalAssets || 1),

      // 權益報酬率 (越高越好)
      returnOnEquity: netIncome / (totalEquity || 1),

      // 毛利率
      grossMargin: financial.grossMargin || 0,

      // 營業利益率
      operatingMargin: financial.operatingMargin || 0,

      // 淨利率
      netMargin: financial.netMargin || 0
    };
  }

  private async saveToDatabase(qualityData: QualityData[]): Promise<void> {
    const db = this.dbManager.getDatabase();

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO quality_data (
        symbol, name, debt_to_equity, current_ratio, quick_ratio,
        long_term_debt_ratio, operating_cash_flow_to_net_income,
        return_on_assets, return_on_equity, gross_margin,
        operating_margin, net_margin, fetched_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const data of qualityData) {
      stmt.run(
        data.symbol,
        data.name,
        data.debtToEquity,
        data.currentRatio,
        data.quickRatio,
        data.longTermDebtRatio,
        data.operatingCashFlowToNetIncome,
        data.returnOnAssets,
        data.returnOnEquity,
        data.grossMargin,
        data.operatingMargin,
        data.netMargin,
        data.fetchedAt.toISOString()
      );
    }
  }
}
