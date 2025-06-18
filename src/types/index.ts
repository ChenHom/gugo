// 核心類型定義
export interface StockData {
  stockNo: string;
  name?: string;
  date: string;
}

export interface ValuationData extends StockData {
  per?: number | undefined;
  pbr?: number | undefined;
  dividendYield?: number | undefined;
}

export interface GrowthData extends StockData {
  month: string;
  revenue?: number | undefined;
  yoy?: number | undefined;
  mom?: number | undefined;
  eps?: number | undefined;
  epsQoQ?: number | undefined;
}

export interface QualityData {
  symbol: string;
  name: string;
  debtToEquity: number;
  currentRatio: number;
  quickRatio: number;
  longTermDebtRatio: number;
  operatingCashFlowToNetIncome: number;
  returnOnAssets: number;
  returnOnEquity: number;
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  fetchedAt: Date;
}

export interface CompanyInfo {
  symbol: string;
  name: string;
  market: string;
  industry: string;
  listingDate: string;
}

export interface FundFlowData extends StockData {
  foreignNet?: number;
  invTrustNet?: number;
  holdingRatio?: number;
}

export interface PriceData extends StockData {
  close?: number;
  volume?: number;
}

export interface StockScore {
  stockNo: string;
  valuationScore: number;
  growthScore: number;
  qualityScore: number;
  fundFlowScore: number;
  momentumScore: number;
  totalScore: number;
}

export interface FetchOptions {
  date?: string | undefined;
  stockNos?: string[] | undefined;
  useCache?: boolean;
  cacheExpiry?: number; // milliseconds
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T[];
  error?: string;
  cachedAt?: number;
}

export type FactorWeights = {
  valuation: number;
  growth: number;
  quality: number;
  fundFlow: number;
  momentum: number;
};

export const DEFAULT_WEIGHTS: FactorWeights = {
  valuation: 0.4,
  growth: 0.25,
  quality: 0.15,
  fundFlow: 0.1,
  momentum: 0.1,
};

export interface SubScores {
  valuation: number;
  growth: number;
  quality: number;
  chips: number;
  momentum: number;
}

export interface ScoreResult extends SubScores {
  total: number;
  missing: string[];
}

export const DEFAULT_SUB_WEIGHTS: SubScores = {
  valuation: 40,
  growth: 25,
  quality: 15,
  chips: 10,
  momentum: 10,
};
