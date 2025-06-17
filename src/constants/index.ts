// 常數定義
export const API_BASE_URL = 'https://openapi.twse.com.tw';
export const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v3';

export const API_ENDPOINTS = {
  VALUATION: '/v1/exchangeReport/BWIBBU_d',
  // 月營收資料改用 FinMind API
  GROWTH_REVENUE: 'FINMIND_MONTHLY_REVENUE', // FinMind TaiwanStockMonthRevenue
  // EPS 資料改用 FinMind API
  GROWTH_EPS: 'FINMIND_FINANCIAL_STATEMENTS', // FinMind TaiwanStockFinancialStatements
  QUALITY: '/v1/opendata/t187ap05_L',
  PRICE: '/v1/exchangeReport/MI_INDEX',
  // 資金流資料改用 FinMind API
  FUND_FLOW: 'FINMIND_INSTITUTIONAL_INVESTORS', // FinMind TaiwanStockInstitutionalInvestorsBuySell
  // 新增更多 FinMind API 端點
  STOCK_PRICE: 'FINMIND_STOCK_PRICE', // FinMind TaiwanStockPrice
  STOCK_PER: 'FINMIND_STOCK_PER', // FinMind TaiwanStockPER (PER/PBR)
  BALANCE_SHEET: 'FINMIND_BALANCE_SHEET', // FinMind TaiwanStockBalanceSheet
  CASH_FLOW: 'FINMIND_CASH_FLOW', // FinMind TaiwanStockCashFlowsStatement
  DIVIDEND: 'FINMIND_DIVIDEND', // FinMind TaiwanStockDividend
  MARKET_VALUE: 'FINMIND_MARKET_VALUE', // FinMind TaiwanStockMarketValue
} as const;

export const TWSE_ENDPOINTS = {
  COMPANY_INFO: '/v1/opendata/t187ap03_L',
  FINANCIAL_STATEMENTS: '/v1/opendata/t187ap05_L',
  VALUATION: '/v1/exchangeReport/BWIBBU_d',
  GROWTH_REVENUE: 'FINMIND_MONTHLY_REVENUE',
  GROWTH_EPS: 'FINMIND_FINANCIAL_STATEMENTS',
  QUALITY: '/v1/opendata/t187ap05_L',
  PRICE: '/v1/exchangeReport/MI_INDEX',
  FUND_FLOW: 'FINMIND_INSTITUTIONAL_INVESTORS',
  // 新增更多 FinMind API 端點
  STOCK_PRICE: 'FINMIND_STOCK_PRICE',
  STOCK_PER: 'FINMIND_STOCK_PER',
  BALANCE_SHEET: 'FINMIND_BALANCE_SHEET',
  CASH_FLOW: 'FINMIND_CASH_FLOW',
  DIVIDEND: 'FINMIND_DIVIDEND',
  MARKET_VALUE: 'FINMIND_MARKET_VALUE',
} as const;

export const FINMIND_ENDPOINTS = {
  MONTHLY_REVENUE: '/data',
  FINANCIAL_STATEMENTS: '/data',
  INSTITUTIONAL_INVESTORS: '/data',
  STOCK_PRICE: '/data',
  STOCK_PER: '/data',
  BALANCE_SHEET: '/data',
  CASH_FLOW: '/data',
  DIVIDEND: '/data',
  MARKET_VALUE: '/data',
} as const;

export const CACHE_CONFIG = {
  DIR: '.cache',
  EXPIRY: {
    DAILY: 24 * 60 * 60 * 1000, // 1 day
    MONTHLY: 30 * 24 * 60 * 60 * 1000, // 30 days
    YEARLY: 365 * 24 * 60 * 60 * 1000, // 1 year
  },
} as const;

export const DB_CONFIG = {
  PATH: 'data/fundamentals.db',
  TIMEOUT: 10000,
} as const;

export const SCORING_CONFIG = {
  MIN_SCORE: 0,
  MAX_SCORE: 100,
  BASE_SCORE: 50,
} as const;

export const RATE_LIMIT = {
  REQUESTS_PER_SECOND: 2,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
} as const;
