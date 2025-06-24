/**
 * 測試資料產生器
 * 提供各種 mock 資料的建立功能
 */

export interface MockStockInfo {
  code: string;
  name: string;
  basePrice: number;
  marketCap: number;
}

export interface MockPriceData {
  stock_id: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  trading_money: number;
}

export interface MockValuationData {
  stockNo: string;
  date: string;
  per: number;
  pbr: number;
  dividendYield: number;
}

export interface MockGrowthData {
  stockNo: string;
  month: string;
  revenue: number;
  yoy: number;
  mom: number;
  eps: number;
  eps_qoq: number;
}

export interface MockQualityData {
  stockNo: string;
  year: number;
  roe: number;
  gross_margin: number;
  operating_margin: number;
  debt_ratio: number;
  current_ratio: number;
}

export interface MockFundFlowData {
  stockNo: string;
  date: string;
  foreign_net: number;
  inv_trust_net: number;
  dealer_net: number;
}

/**
 * 預設的測試股票清單
 */
export const DEFAULT_TEST_STOCKS: MockStockInfo[] = [
  { code: '2330', name: '台積電', basePrice: 600, marketCap: 15000000000000 },
  { code: '2317', name: '鴻海', basePrice: 120, marketCap: 1700000000000 },
  { code: '2454', name: '聯發科', basePrice: 800, marketCap: 1300000000000 },
  { code: '2412', name: '中華電', basePrice: 110, marketCap: 850000000000 },
  { code: '1301', name: '台塑', basePrice: 95, marketCap: 780000000000 }
];

/**
 * 建立模擬股價資料
 */
export function createMockPriceData(
  stockCode: string,
  startDate: string,
  days: number = 30,
  basePrice: number = 100
): MockPriceData[] {
  const data: MockPriceData[] = [];
  const start = new Date(startDate);

  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);

    // 模擬價格波動（隨機遊走）
    const volatility = 0.02; // 2% 日波動率
    const drift = 0.0003; // 0.03% 日漂移
    const randomChange = (Math.random() - 0.5) * volatility + drift;
    const currentPrice = basePrice * (1 + randomChange * i);

    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const close = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    const volume = Math.floor((Math.random() * 2000000 + 500000));

    data.push({
      stock_id: stockCode,
      date: date.toISOString().split('T')[0]!,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
      trading_money: Number((close * volume).toFixed(0))
    });
  }

  return data;
}

/**
 * 建立模擬估值資料
 */
export function createMockValuationData(
  stockCode: string,
  date: string,
  basePrice: number = 100
): MockValuationData {
  // 根據基準價格估算合理的估值指標
  const earnings = basePrice / (15 + Math.random() * 10); // 模擬每股盈餘
  const bookValue = basePrice / (2 + Math.random() * 2); // 模擬每股淨值

  return {
    stockNo: stockCode,
    date,
    per: Number((basePrice / earnings).toFixed(2)),
    pbr: Number((basePrice / bookValue).toFixed(2)),
    dividendYield: Number((2 + Math.random() * 3).toFixed(2)) // 2-5% 殖利率
  };
}

/**
 * 建立模擬成長資料
 */
export function createMockGrowthData(
  stockCode: string,
  month: string,
  baseRevenue: number = 1000000000
): MockGrowthData {
  const yoyGrowth = (Math.random() - 0.3) * 0.5; // -15% 到 +20% 年增率
  const momGrowth = (Math.random() - 0.5) * 0.2; // -10% 到 +10% 月增率
  const epsGrowth = (Math.random() - 0.2) * 0.6; // -20% 到 +40% EPS 增率

  return {
    stockNo: stockCode,
    month,
    revenue: Math.floor(baseRevenue * (1 + yoyGrowth)),
    yoy: Number((yoyGrowth * 100).toFixed(2)),
    mom: Number((momGrowth * 100).toFixed(2)),
    eps: Number((5 + Math.random() * 10).toFixed(2)), // 5-15 元 EPS
    eps_qoq: Number((epsGrowth * 100).toFixed(2))
  };
}

/**
 * 建立模擬品質資料
 */
export function createMockQualityData(
  stockCode: string,
  year: number
): MockQualityData {
  // 不同產業的典型財務比率
  const industryProfile = getIndustryProfile(stockCode);

  return {
    stockNo: stockCode,
    year,
    roe: Number((industryProfile.baseROE + (Math.random() - 0.5) * 0.1).toFixed(2)),
    gross_margin: Number((industryProfile.baseGrossMargin + (Math.random() - 0.5) * 0.1).toFixed(2)),
    operating_margin: Number((industryProfile.baseOpMargin + (Math.random() - 0.5) * 0.05).toFixed(2)),
    debt_ratio: Number((industryProfile.baseDebtRatio + (Math.random() - 0.5) * 0.1).toFixed(2)),
    current_ratio: Number((industryProfile.baseCurrentRatio + (Math.random() - 0.5) * 0.5).toFixed(2))
  };
}

/**
 * 建立模擬資金流向資料
 */
export function createMockFundFlowData(
  stockCode: string,
  date: string
): MockFundFlowData {
  // 模擬三大法人買賣超（以張為單位）
  const foreignFlow = Math.floor((Math.random() - 0.5) * 10000); // ±5000張
  const investFlow = Math.floor((Math.random() - 0.5) * 3000);   // ±1500張
  const dealerFlow = Math.floor((Math.random() - 0.5) * 1000);   // ±500張

  return {
    stockNo: stockCode,
    date,
    foreign_net: foreignFlow,
    inv_trust_net: investFlow,
    dealer_net: dealerFlow
  };
}

/**
 * 根據股票代碼取得產業特徵
 */
function getIndustryProfile(stockCode: string) {
  // 簡化的產業分類
  const profiles = {
    semiconductor: { // 半導體（台積電、聯發科）
      baseROE: 0.20,
      baseGrossMargin: 0.50,
      baseOpMargin: 0.35,
      baseDebtRatio: 0.15,
      baseCurrentRatio: 2.0
    },
    electronics: { // 電子製造（鴻海）
      baseROE: 0.12,
      baseGrossMargin: 0.08,
      baseOpMargin: 0.04,
      baseDebtRatio: 0.25,
      baseCurrentRatio: 1.3
    },
    telecom: { // 電信（中華電）
      baseROE: 0.15,
      baseGrossMargin: 0.45,
      baseOpMargin: 0.25,
      baseDebtRatio: 0.30,
      baseCurrentRatio: 1.1
    },
    petrochemical: { // 石化（台塑）
      baseROE: 0.10,
      baseGrossMargin: 0.15,
      baseOpMargin: 0.08,
      baseDebtRatio: 0.35,
      baseCurrentRatio: 1.5
    }
  };

  // 根據股票代碼分類
  if (['2330', '2454'].includes(stockCode)) {
    return profiles.semiconductor;
  } else if (['2317'].includes(stockCode)) {
    return profiles.electronics;
  } else if (['2412'].includes(stockCode)) {
    return profiles.telecom;
  } else if (['1301'].includes(stockCode)) {
    return profiles.petrochemical;
  }

  // 預設為電子業
  return profiles.electronics;
}

/**
 * 建立完整的測試資料集
 */
export function createFullMockDataset(
  stockCodes: string[] = ['2330', '2317', '2454'],
  startDate: string = '2024-01-01',
  days: number = 30
) {
  const dataset = {
    prices: [] as MockPriceData[],
    valuations: [] as MockValuationData[],
    growth: [] as MockGrowthData[],
    quality: [] as MockQualityData[],
    fundFlow: [] as MockFundFlowData[]
  };

  for (const stockCode of stockCodes) {
    const stockInfo = DEFAULT_TEST_STOCKS.find(s => s.code === stockCode) || DEFAULT_TEST_STOCKS[0]!;

    // 生成股價資料
    dataset.prices.push(...createMockPriceData(stockCode, startDate, days, stockInfo.basePrice));

    // 生成估值資料
    dataset.valuations.push(createMockValuationData(stockCode, startDate, stockInfo.basePrice));

    // 生成成長資料（近3個月）
    for (let i = 0; i < 3; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() - i);
      const monthStr = date.toISOString().slice(0, 7); // YYYY-MM
      dataset.growth.push(createMockGrowthData(stockCode, monthStr));
    }

    // 生成品質資料（近2年）
    const currentYear = new Date(startDate).getFullYear();
    for (let year = currentYear - 1; year <= currentYear; year++) {
      dataset.quality.push(createMockQualityData(stockCode, year));
    }

    // 生成資金流向資料（最近10天）
    for (let i = 0; i < 10; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0]!;
      dataset.fundFlow.push(createMockFundFlowData(stockCode, dateStr));
    }
  }

  return dataset;
}

/**
 * 建立 API 回應的 mock 資料
 */
export function createMockApiResponse<T>(data: T, success: boolean = true, error?: string) {
  return {
    success,
    data: success ? data : undefined,
    error: success ? undefined : error,
    timestamp: new Date().toISOString()
  };
}

/**
 * 建立隨機錯誤回應
 */
export function createMockErrorResponse(errorType: 'network' | 'api' | 'timeout' | 'auth' = 'api') {
  const errors = {
    network: 'Network connection failed',
    api: 'API server error (500)',
    timeout: 'Request timeout',
    auth: 'Authentication failed (401)'
  };

  return createMockApiResponse(null, false, errors[errorType]);
}
