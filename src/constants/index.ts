// 常數定義
export const API_BASE_URL = 'https://openapi.twse.com.tw';

export const API_ENDPOINTS = {
  VALUATION: '/v1/exchangeReport/BWIBBU_d',
  // Note: TWSE OpenAPI doesn't provide monthly revenue data directly
  // t187ap03_L contains company basic info, not monthly revenue
  GROWTH_REVENUE: '/v1/opendata/t187ap03_L', // TODO: Find correct monthly revenue endpoint
  GROWTH_EPS: '/v1/opendata/t51apim03_A',
  QUALITY: '/v1/opendata/t187ap05_L',
  PRICE: '/v1/exchangeReport/MI_INDEX',
  FUND_FLOW: '/fund/TWT38U',
} as const;

export const TWSE_ENDPOINTS = {
  COMPANY_INFO: '/v1/opendata/t187ap03_L',
  FINANCIAL_STATEMENTS: '/v1/opendata/t187ap05_L',
  VALUATION: '/v1/exchangeReport/BWIBBU_d',
  GROWTH_REVENUE: '/v1/opendata/t187ap03_L',
  GROWTH_EPS: '/v1/opendata/t51apim03_A',
  QUALITY: '/v1/opendata/t187ap05_L',
  PRICE: '/v1/exchangeReport/MI_INDEX',
  FUND_FLOW: '/fund/TWT38U',
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
