import fetch from 'node-fetch';
import { FINMIND_BASE_URL } from '../constants/index.js';
import { defaultCache } from './simpleCache.js';

export interface FinMindApiResponse<T = any> {
  status: number;
  msg: string;
  data: T[];
}

export interface MonthlyRevenueData {
  date: string;
  stock_id: string;
  revenue: number;
  revenue_month: number;
  revenue_year: number;
  last_year_revenue: number;
  last_month_revenue: number;
  revenue_rate: number;
  last_year_revenue_rate: number;
}

export interface FinancialStatementsData {
  date: string;
  stock_id: string;
  type: string;
  value: number;
  origin_name: string;
}

export interface InstitutionalInvestorsData {
  date: string;
  stock_id: string;
  name: string;
  buy: number;
  sell: number;
  diff: number;
}

// 新增更多資料類型接口
export interface StockPriceData {
  date: string;
  stock_id: string;
  Trading_Volume: number;
  Trading_money: number;
  open: number;
  max: number;
  min: number;
  close: number;
  spread: number;
  Trading_turnover: number;
}

export interface StockPERData {
  date: string;
  stock_id: string;
  PER: number;
  PBR: number;
  dividend_yield: number;
  stock_name: string;
}

export interface BalanceSheetData {
  date: string;
  stock_id: string;
  type: string;
  value: number;
  origin_name: string;
}

export interface CashFlowData {
  date: string;
  stock_id: string;
  type: string;
  value: number;
  origin_name: string;
}

export interface DividendData {
  date: string;
  stock_id: string;
  dividend_type: string;
  stock_symbol: string;
  dividend: number;
  stock_name: string;
}

export interface MarketValueData {
  date: string;
  stock_id: string;
  market_value: number;
  stock_name: string;
}

export class FinMindClient {
  private baseUrl: string;
  private token: string | undefined;

  constructor(token?: string) {
    this.baseUrl = FINMIND_BASE_URL;
    // 優先使用傳入的 token，其次從環境變數讀取
    this.token = token || process.env.FINMIND_TOKEN;
  }

  private async makeRequest<T>(
    dataset: string,
    params: Record<string, string> = {},
    useCache: boolean = true,
    cacheTtlMinutes: number = 30
  ): Promise<FinMindApiResponse<T>> {
    // 建立快取鍵值
    const cacheKey = `${dataset}_${JSON.stringify(params)}`;

    // 嘗試從快取讀取
    if (useCache) {
      const cachedData = await defaultCache.get<FinMindApiResponse<T>>(cacheKey);
      if (cachedData) {
        console.log(`使用快取資料: ${dataset}`);
        return cachedData;
      }
    }

    const url = new URL('/data', this.baseUrl);

    // 設定基本參數
    url.searchParams.set('dataset', dataset);

    // 如果有 token，加入參數
    if (this.token) {
      url.searchParams.set('token', this.token);
    }

    // 加入其他參數
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    console.log(`請求 FinMind API: ${dataset} - ${url.toString()}`);
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`FinMind API request failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json() as FinMindApiResponse<T>;

    // 儲存到快取
    if (useCache && result.status === 200) {
      await defaultCache.set(cacheKey, result, cacheTtlMinutes);
    }

    return result;
  }

  /**
   * 獲取月營收資料
   */
  async getMonthlyRevenue(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<MonthlyRevenueData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<MonthlyRevenueData>(
      'TaiwanStockMonthRevenue',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch monthly revenue: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取財務報表資料（包含 EPS）
   */
  async getFinancialStatements(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<FinancialStatementsData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<FinancialStatementsData>(
      'TaiwanStockFinancialStatements',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch financial statements: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取三大法人買賣超資料
   */
  async getInstitutionalInvestors(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<InstitutionalInvestorsData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<InstitutionalInvestorsData>(
      'TaiwanStockInstitutionalInvestorsBuySell',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch institutional investors data: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取股價資料
   */
  async getStockPrice(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<StockPriceData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<StockPriceData>(
      'TaiwanStockPrice',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch stock price: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取 PER/PBR 資料
   */
  async getStockPER(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<StockPERData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<StockPERData>(
      'TaiwanStockPER',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch PER/PBR data: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取資產負債表資料
   */
  async getBalanceSheet(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<BalanceSheetData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<BalanceSheetData>(
      'TaiwanStockBalanceSheet',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch balance sheet: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取現金流量表資料
   */
  async getCashFlow(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<CashFlowData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<CashFlowData>(
      'TaiwanStockCashFlowsStatement',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch cash flow: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取股利政策資料
   */
  async getDividend(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<DividendData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<DividendData>(
      'TaiwanStockDividend',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch dividend data: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 獲取市值資料
   */
  async getMarketValue(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<MarketValueData[]> {
    const params: Record<string, string> = {
      data_id: stockId,
      start_date: startDate,
    };

    if (endDate) {
      params.end_date = endDate;
    }

    const response = await this.makeRequest<MarketValueData>(
      'TaiwanStockMarketValue',
      params
    );

    if (response.status !== 200) {
      throw new Error(`Failed to fetch market value: ${response.msg}`);
    }

    return response.data;
  }

  /**
   * 從 EPS 相關的財務報表資料中提取 EPS
   */
  extractEpsFromFinancialStatements(
    financialData: FinancialStatementsData[]
  ): Array<{ date: string; eps: number }> {
    // 尋找每股盈餘相關欄位
    const epsData = financialData.filter(item =>
      item.origin_name.includes('每股盈餘') ||
      item.origin_name.includes('基本每股盈餘') ||
      item.origin_name.includes('EPS')
    );

    return epsData.map(item => ({
      date: item.date,
      eps: item.value
    }));
  }

  /**
   * 計算營收年增率和月增率
   */
  calculateRevenueGrowthRates(
    revenueData: MonthlyRevenueData[]
  ): Array<{
    date: string;
    revenue: number;
    yoy: number;
    mom: number;
  }> {
    return revenueData.map(item => ({
      date: item.date,
      revenue: item.revenue,
      yoy: item.revenue_rate, // FinMind 已提供年增率
      mom: item.last_year_revenue_rate // FinMind 已提供月增率
    }));
  }

  /**
   * 計算三大法人淨買超
   */
  calculateInstitutionalNetBuy(
    institutionalData: InstitutionalInvestorsData[]
  ): Array<{
    date: string;
    foreign_net: number;
    investment_trust_net: number;
    dealer_net: number;
  }> {
    const groupedByDate = institutionalData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = {
          date: item.date,
          foreign_net: 0,
          investment_trust_net: 0,
          dealer_net: 0
        };
      }

      // 根據法人類型分配
      if (item.name.includes('外資')) {
        acc[item.date].foreign_net = item.diff;
      } else if (item.name.includes('投信')) {
        acc[item.date].investment_trust_net = item.diff;
      } else if (item.name.includes('自營商')) {
        acc[item.date].dealer_net = item.diff;
      }

      return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedByDate);
  }

  /**
   * 從資產負債表中提取關鍵指標（ROE、負債比率等）
   */
  extractBalanceSheetMetrics(
    balanceSheetData: BalanceSheetData[]
  ): Array<{
    date: string;
    totalAssets?: number;
    totalLiabilities?: number;
    totalEquity?: number;
    debtRatio?: number;
  }> {
    const groupedByDate = balanceSheetData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date };
      }

      // 根據科目名稱分類
      if (item.origin_name.includes('資產總額') || item.origin_name.includes('總資產')) {
        acc[item.date].totalAssets = item.value;
      } else if (item.origin_name.includes('負債總額') || item.origin_name.includes('總負債')) {
        acc[item.date].totalLiabilities = item.value;
      } else if (item.origin_name.includes('權益總額') || item.origin_name.includes('總權益')) {
        acc[item.date].totalEquity = item.value;
      }

      return acc;
    }, {} as Record<string, any>);

    // 計算負債比率
    return Object.values(groupedByDate).map((item: any) => {
      if (item.totalAssets && item.totalLiabilities) {
        item.debtRatio = (item.totalLiabilities / item.totalAssets) * 100;
      }
      return item;
    });
  }

  /**
   * 從損益表中提取毛利率、營業利益率等品質指標
   */
  extractQualityMetrics(
    financialData: FinancialStatementsData[]
  ): Array<{
    date: string;
    grossMargin?: number;
    operatingMargin?: number;
    netMargin?: number;
    revenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
  }> {
    const groupedByDate = financialData.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date };
      }

      // 根據科目名稱分類
      if (item.origin_name.includes('營業收入') || item.origin_name.includes('總收入')) {
        acc[item.date].revenue = item.value;
      } else if (item.origin_name.includes('毛利')) {
        acc[item.date].grossProfit = item.value;
      } else if (item.origin_name.includes('營業利益') || item.origin_name.includes('營業收益')) {
        acc[item.date].operatingIncome = item.value;
      } else if (item.origin_name.includes('本期淨利') || item.origin_name.includes('淨利')) {
        acc[item.date].netIncome = item.value;
      }

      return acc;
    }, {} as Record<string, any>);

    // 計算各種利潤率
    return Object.values(groupedByDate).map((item: any) => {
      if (item.revenue) {
        if (item.grossProfit) {
          item.grossMargin = (item.grossProfit / item.revenue) * 100;
        }
        if (item.operatingIncome) {
          item.operatingMargin = (item.operatingIncome / item.revenue) * 100;
        }
        if (item.netIncome) {
          item.netMargin = (item.netIncome / item.revenue) * 100;
        }
      }
      return item;
    });
  }
}
