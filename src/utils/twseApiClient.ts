import fetch from 'node-fetch';
import { API_BASE_URL } from '../constants/index.js';
import { defaultCache } from './simpleCache.js';

export interface TWSeApiResponse<T = any> {
  stat: string;
  date: string;
  title: string;
  fields: string[];
  data: T[];
  notes?: string[];
}

export interface TWSEInstitutionalFlowData {
  [key: string]: string | number;
  日期?: string;
  股票代號?: string;
  股票名稱?: string;
  外資及陸資買進股數?: string;
  外資及陸資賣出股數?: string;
  外資及陸資買賣超股數?: string;
  投信買進股數?: string;
  投信賣出股數?: string;
  投信買賣超股數?: string;
  自營商買進股數?: string;
  自營商賣出股數?: string;
  自營商買賣超股數?: string;
}

export interface TWSEMonthlyRevenueData {
  [key: string]: string | number;
  出表日期?: string;
  公司代號?: string;
  公司名稱?: string;
  當月營收?: string;
  上月營收?: string;
  去年當月營收?: string;
  上月比較增減?: string;
  去年同月增減?: string;
  累計營收?: string;
  去年累計營收?: string;
  前期比較增減?: string;
}

export interface TWSEValuationData {
  [key: string]: string | number;
  Code?: string;
  Name?: string;
  PEratio?: string;
  DividendYield?: string;
  PBratio?: string;
}

/**
 * TWSE OpenAPI 客戶端
 * 用來處理台灣證券交易所 OpenAPI 的資料擷取
 */
export class TWSeApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  /**
   * 通用的 API 請求方法
   */
  private async makeRequest<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<TWSeApiResponse<T>> {
    try {
      const url = new URL(endpoint, this.baseUrl);

      // 添加查詢參數
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const cacheKey = url.toString();

      // 檢查快取
      const cached = await defaultCache.get<TWSeApiResponse<T>>(cacheKey);
      if (cached) {
        console.log(`✨ 使用快取: ${endpoint}`);
        return cached;
      }

      console.log(`🌐 TWSE API 請求: ${endpoint}`);
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`TWSE API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as TWSeApiResponse<T>;

      // 檢查 API 回應狀態
      // 如果有 stat 欄位，必須是 'OK'
      if (data.stat !== undefined && data.stat !== 'OK') {
        throw new Error(`TWSE API error: ${data.stat}`);
      }

      // 檢查是否有有效資料 - 至少要有 data 欄位
      if (!data.data) {
        if (endpoint.includes('t187ap03_L')) {
          // 月營收 API 特殊處理，輸出更詳細的錯誤資訊
          console.error(`⚠️ TWSE 月營收 API 無資料返回: ${JSON.stringify(data)}`);
          throw new Error(`TWSE 月營收 API 無資料: 可能是此月份尚未公布或無此股票資料`);
        } else {
          throw new Error(`TWSE API error: No data returned`);
        }
      }

      // 如果 data 存在但為空陣列，也需要處理
      if (Array.isArray(data.data) && data.data.length === 0) {
        if (endpoint.includes('t187ap03_L')) {
          console.warn(`⚠️ TWSE 月營收 API 返回空陣列: ${JSON.stringify(params || {})}`);
        }
      }

      // 快取結果（3小時）
      defaultCache.set(cacheKey, data, 3 * 60 * 60 * 1000);

      return data;
    } catch (error) {
      console.error(`❌ TWSE API 請求失敗: ${endpoint} -`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  /**
   * 獲取三大法人買賣超資料
   * 端點: /fund/TWT38U
   */
  async getInstitutionalFlow(
    date?: string
  ): Promise<TWSEInstitutionalFlowData[]> {
    const params: Record<string, string> = {};

    if (date) {
      params.date = date.replace(/-/g, ''); // 轉換為 YYYYMMDD 格式
    }

    const response = await this.makeRequest<TWSEInstitutionalFlowData>(
      '/fund/TWT38U',
      params
    );

    return response.data || [];
  }

  /**
   * 獲取月營收資料
   * 端點: /v1/opendata/t187ap03_L
   *
   * TWSE 月營收 API 需要西元年月格式，例如 202501
   * 注意: 這個端點可能要指定股票代號和月份才能正確查詢
   *
   * 參考格式：
   * 1. month=202401 (年月，必須是西元年)
   * 2. date=202401 (年月，有些 API 使用 date 而非 month)
   * 3. stockId=2330 (股票代號，可選)
   */
  async getMonthlyRevenue(
    year?: string,
    month?: string,
    stockId?: string
  ): Promise<TWSEMonthlyRevenueData[]> {
    // 檢查是否是未來日期，避免無效請求
    if (year && month) {
      const requestDate = new Date(`${year}-${month}-01`);
      const today = new Date();
      if (requestDate > today) {
        console.warn(`⚠️ 請求的月份 ${year}-${month} 是未來日期，可能無資料`);
        return [];
      }
    }

    // 預設使用本月日期
    if (!year || !month) {
      const today = new Date();
      year = today.getFullYear().toString();
      // 使用上個月資料，因為本月可能尚未公布
      month = (today.getMonth() === 0 ? 12 : today.getMonth()).toString();
      if (month === '12') {
        year = (parseInt(year) - 1).toString();
      }
    }

    const params: Record<string, string> = {
      response: 'json'  // 明確要求 JSON 格式
    };

    // 格式化: 確保月份為兩位數
    const formattedMonth = month.padStart(2, '0');
    const formattedDate = `${year}${formattedMonth}`;

    // TWSE API 需要 month 參數
    params.month = formattedDate;

    // 同時也添加 date 參數以確保兼容性
    params.date = formattedDate;

    // 如果提供股票代號，也加入查詢參數
    if (stockId) {
      params.stockId = stockId;
    }

    // 檢查參數是否符合要求
    console.log(`🔍 TWSE 月營收 API 查詢參數: ${JSON.stringify(params)}`);

    try {
      const response = await this.makeRequest<TWSEMonthlyRevenueData>(
        '/v1/opendata/t187ap03_L',
        params
      );

      return response.data || [];
    } catch (error) {
      console.error(`❌ TWSE 月營收查詢失敗:`, error instanceof Error ? error.message : error);
      // 如果使用的是未來日期或找不到資料，回傳空數組而不是拋錯
      return [];
    }
  }

  /**
   * 獲取估值資料 (PER、PBR、殖利率)
   * 端點: /v1/exchangeReport/BWIBBU_d
   */
  async getValuationData(
    date?: string
  ): Promise<TWSEValuationData[]> {
    const params: Record<string, string> = {};

    if (date) {
      params.date = date.replace(/-/g, ''); // 轉換為 YYYYMMDD 格式
    }

    const response = await this.makeRequest<TWSEValuationData>(
      '/v1/exchangeReport/BWIBBU_d',
      params
    );

    return response.data || [];
  }

  /**
   * 獲取股價歷史資料
   * 端點: /v1/exchangeReport/STOCK_DAY
   */
  async getStockPriceHistory(
    stockId: string,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    const results: any[] = [];

    // 轉換日期格式
    const start = startDate ? new Date(startDate) : new Date();
    start.setMonth(start.getMonth() - 1);  // 預設抓取前一個月的資料

    const end = endDate ? new Date(endDate) : new Date();

    // 每月抓取資料
    let currentDate = new Date(start);

    while (currentDate <= end) {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');

      try {
        console.log(`📅 抓取 ${stockId} ${year}年${month}月 的股價資料...`);

        const params = {
          date: `${year}${month}01`,  // 每月第一天
          stockNo: stockId,
          response: 'json'
        };

        const response = await this.makeRequest<any[]>(
          `/v1/exchangeReport/STOCK_DAY`,
          params
        );

        if (response.data && response.data.length > 0) {
          // 轉換 TWSE 資料格式為通用格式
          const converted = response.data.map((item: any) => {
            // 將民國年轉換為西元年
            const twDate = item[0];  // 格式: "111/01/03"
            const [twYear, twMonth, twDay] = twDate.split('/');
            const year = parseInt(twYear) + 1911;
            const date = `${year}-${twMonth}-${twDay}`;

            return {
              stock_id: stockId,
              date: date,
              open: parseFloat(item[3].replace(/,/g, '')),
              high: parseFloat(item[4].replace(/,/g, '')),
              low: parseFloat(item[5].replace(/,/g, '')),
              close: parseFloat(item[6].replace(/,/g, '')),
              volume: parseInt(item[8].replace(/,/g, '')) * 1000,
              trading_money: parseInt(item[2].replace(/,/g, '')) * 1000
            };
          });

          console.log(`✅ 成功抓取 ${stockId} ${year}年${month}月 的股價資料: ${converted.length} 筆`);
          results.push(...converted);
        } else {
          console.warn(`⚠️ ${stockId} ${year}年${month}月 無股價資料`);
        }
      } catch (error) {
        console.warn(`⚠️ 抓取 ${stockId} ${year}年${month}月 股價資料失敗:`, error instanceof Error ? error.message : error);
      }

      // 移至下個月
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return results;
  }

  /**
   * 轉換三大法人資料為標準格式
   */
  convertInstitutionalFlowData(
    data: TWSEInstitutionalFlowData[],
    stockId?: string
  ): Array<{
    date: string;
    stock_id: string;
    name: string;
    buy: number;
    sell: number;
    diff: number;
  }> {
    try {
      const results: Array<{
        date: string;
        stock_id: string;
        name: string;
        buy: number;
        sell: number;
        diff: number;
      }> = [];

      for (const item of data) {
        // 如果提供了股票代號，只處理該股票的資料
        if (stockId && item.股票代號 !== stockId) {
          continue;
        }

        // 轉換日期格式: 如果日期格式為 "112/01/01" (民國年)，轉換為西元年 "2023-01-01"
        let dateStr = item.日期 as string || '';
        if (dateStr.includes('/')) {
          const [rocYear, month, day] = dateStr.split('/');
          const year = parseInt(rocYear) + 1911;
          dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        const stock_id = item.股票代號 as string || '';
        const stockName = item.股票名稱 as string || '';

        // 處理外資
        if (item.外資及陸資買進股數 !== undefined) {
          const foreignBuy = parseFloat(String(item.外資及陸資買進股數).replace(/,/g, '')) || 0;
          const foreignSell = parseFloat(String(item.外資及陸資賣出股數).replace(/,/g, '')) || 0;
          const foreignNet = parseFloat(String(item.外資及陸資買賣超股數).replace(/,/g, '')) || 0;

          results.push({
            date: dateStr,
            stock_id: stock_id,
            name: '外資及陸資',
            buy: foreignBuy,
            sell: foreignSell,
            diff: foreignNet
          });
        }

        // 處理投信
        if (item.投信買進股數 !== undefined) {
          const investTrustBuy = parseFloat(String(item.投信買進股數).replace(/,/g, '')) || 0;
          const investTrustSell = parseFloat(String(item.投信賣出股數).replace(/,/g, '')) || 0;
          const investTrustNet = parseFloat(String(item.投信買賣超股數).replace(/,/g, '')) || 0;

          results.push({
            date: dateStr,
            stock_id: stock_id,
            name: '投信',
            buy: investTrustBuy,
            sell: investTrustSell,
            diff: investTrustNet
          });
        }

        // 處理自營商
        if (item.自營商買進股數 !== undefined) {
          const dealerBuy = parseFloat(String(item.自營商買進股數).replace(/,/g, '')) || 0;
          const dealerSell = parseFloat(String(item.自營商賣出股數).replace(/,/g, '')) || 0;
          const dealerNet = parseFloat(String(item.自營商買賣超股數).replace(/,/g, '')) || 0;

          results.push({
            date: dateStr,
            stock_id: stock_id,
            name: '自營商',
            buy: dealerBuy,
            sell: dealerSell,
            diff: dealerNet
          });
        }
      }

      return results;
    } catch (error) {
      console.error('轉換三大法人資料失敗:', error);
      return [];
    }
  }

  /**
   * 轉換 TWSE 月營收資料為標準格式
   */
  convertMonthlyRevenueData(
    twseData: TWSEMonthlyRevenueData[]
  ): Array<{
    date: string;
    stock_id: string;
    revenue: number;
    revenue_month: number;
    revenue_year: number;
    last_year_revenue: number;
    last_month_revenue: number;
    revenue_rate: number;
    last_year_revenue_rate: number;
  }> {
    return twseData.map(item => {
      const dateStr = item.出表日期 as string;
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));

      return {
        date: `${year}-${month.toString().padStart(2, '0')}-01`,
        stock_id: item.公司代號 as string,
        revenue: this.parseNumber(item.當月營收),
        revenue_month: month,
        revenue_year: year,
        last_year_revenue: this.parseNumber(item.去年當月營收),
        last_month_revenue: this.parseNumber(item.上月營收),
        revenue_rate: this.parseNumber(item.上月比較增減),
        last_year_revenue_rate: this.parseNumber(item.去年同月增減)
      };
    });
  }

  /**
   * 解析數字字串
   */
  private parseNumber(value: string | number | undefined): number {
    if (typeof value === 'number') return value;
    if (!value || value === '--' || value === 'N/A') return 0;

    const str = value.toString().replace(/,/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }

  /**
   * 格式化日期 (YYYYMMDD -> YYYY-MM-DD)
   */
  private formatDate(dateStr: string): string {
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  }

  /**
   * 獲取估值資料 (PER, PBR, DividendYield)
   * 端點: /v1/exchangeReport/BWIBBU_d
   */
  async getValuation(
    stockId: string,
    date?: string
  ): Promise<TWSEValuationData[]> {
    const params: Record<string, string> = {
      response: 'json'
    };

    if (stockId) {
      params.stockNo = stockId;
    }

    if (date) {
      params.date = date.replace(/-/g, ''); // 轉換為 YYYYMMDD 格式
    }

    try {
      console.log(`🔍 TWSE 估值 API 查詢: ${stockId}, 參數: ${JSON.stringify(params)}`);
      const response = await this.makeRequest<TWSEValuationData>(
        '/v1/exchangeReport/BWIBBU_d',
        params
      );

      if (!response.data || response.data.length === 0) {
        console.warn(`⚠️ TWSE API 未返回 ${stockId} 的估值資料`);
        return [];
      }

      return response.data;
    } catch (error) {
      console.error(`❌ TWSE 估值資料獲取失敗:`, error);
      return [];
    }
  }
}
