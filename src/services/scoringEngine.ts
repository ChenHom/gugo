// 評分引擎 - 計算各項指標得分
import { DatabaseManager } from '../utils/databaseManager.js';
import { DataTransformer } from './dataTransformer.js';
import { DataCleaner } from './dataCleaner.js';
import { SCORING_CONFIG } from '../constants/index.js';
import { StockScore, FactorWeights, DEFAULT_WEIGHTS } from '../types/index.js';

export class ScoringEngine {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = new DatabaseManager();
  }

  async initialize(): Promise<void> {
    await this.dbManager.initialize();
  }

  async calculateStockScores(
    stockCodes?: string[],
    weights: FactorWeights = DEFAULT_WEIGHTS
  ): Promise<StockScore[]> {
    // Get all required data
    const valuationData = await this.dbManager.getValuationData();
    const growthData = await this.dbManager.getGrowthData();

    // Clean data
    const cleanValuation = DataCleaner.cleanValuationData(
      valuationData.map(row => ({
        stockNo: row.stock_no,
        date: row.date,
        per: row.per,
        pbr: row.pbr,
        dividendYield: row.dividend_yield,
      }))
    );

    const cleanGrowth = DataCleaner.cleanGrowthData(
      growthData.map(row => ({
        stockNo: row.stock_no,
        date: row.month,
        month: row.month,
        revenue: row.revenue,
        yoy: row.yoy,
        mom: row.mom,
        eps: row.eps,
        epsQoQ: row.eps_qoq,
      }))
    );

    // Get unique stock codes
    const allStockCodes = new Set([
      ...cleanValuation.map(item => item.stockNo),
      ...cleanGrowth.map(item => item.stockNo),
    ]);

    const targetStocks = stockCodes
      ? stockCodes.filter(code => allStockCodes.has(code))
      : Array.from(allStockCodes);

    // Calculate scores for each stock
    const scores: StockScore[] = [];

    for (const stockNo of targetStocks) {
      const score = await this.calculateIndividualScore(
        stockNo,
        cleanValuation,
        cleanGrowth,
        weights
      );

      if (score) {
        scores.push(score);
      }
    }

    return scores;
  }

  private async calculateIndividualScore(
    stockNo: string,
    valuationData: any[],
    growthData: any[],
    weights: FactorWeights
  ): Promise<StockScore | null> {
    const stockValuation = valuationData.filter(item => item.stockNo === stockNo);
    const stockGrowth = growthData.filter(item => item.stockNo === stockNo);

    if (stockValuation.length === 0 && stockGrowth.length === 0) {
      return null;
    }

    // Get latest data for each category
    const latestValuation = stockValuation.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    const latestGrowth = stockGrowth.sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];

    // Calculate individual factor scores
    const valuationScore = this.calculateValuationScore(latestValuation, valuationData);
    const growthScore = this.calculateGrowthScore(latestGrowth, growthData);

    // For now, set other scores to base value (will implement later)
    const qualityScore = SCORING_CONFIG.BASE_SCORE;
    const fundFlowScore = SCORING_CONFIG.BASE_SCORE;
    const momentumScore = SCORING_CONFIG.BASE_SCORE;

    // Calculate weighted total score
    const totalScore =
      weights.valuation * valuationScore +
      weights.growth * growthScore +
      weights.quality * qualityScore +
      weights.fundFlow * fundFlowScore +
      weights.momentum * momentumScore;

    return {
      stockNo,
      valuationScore,
      growthScore,
      qualityScore,
      fundFlowScore,
      momentumScore,
      totalScore: Math.max(SCORING_CONFIG.MIN_SCORE, Math.min(SCORING_CONFIG.MAX_SCORE, totalScore)),
    };
  }

  private calculateValuationScore(stockData: any, allData: any[]): number {
    if (!stockData) return SCORING_CONFIG.BASE_SCORE;

    let score = SCORING_CONFIG.BASE_SCORE;
    let components = 0;

    // PER score (lower is better)
    if (stockData.per !== undefined && stockData.per > 0) {
      const allPers = allData
        .map(item => item.per)
        .filter(per => per !== undefined && per > 0);

      if (allPers.length > 0) {
        const stats = DataTransformer.calculateStats(allPers);
        const zScore = DataTransformer.zScore(stockData.per, stats.mean, stats.stdDev);
        const perScore = SCORING_CONFIG.BASE_SCORE + 25 * (-zScore); // Negative z-score is better
        score += Math.max(0, Math.min(100, perScore));
        components++;
      }
    }

    // PBR score (lower is better)
    if (stockData.pbr !== undefined && stockData.pbr > 0) {
      const allPbrs = allData
        .map(item => item.pbr)
        .filter(pbr => pbr !== undefined && pbr > 0);

      if (allPbrs.length > 0) {
        const stats = DataTransformer.calculateStats(allPbrs);
        const zScore = DataTransformer.zScore(stockData.pbr, stats.mean, stats.stdDev);
        const pbrScore = SCORING_CONFIG.BASE_SCORE + 25 * (-zScore); // Negative z-score is better
        score += Math.max(0, Math.min(100, pbrScore));
        components++;
      }
    }

    // Dividend Yield score (higher is better)
    if (stockData.dividendYield !== undefined && stockData.dividendYield > 0) {
      const allYields = allData
        .map(item => item.dividendYield)
        .filter(yieldValue => yieldValue !== undefined && yieldValue > 0);

      if (allYields.length > 0) {
        const stats = DataTransformer.calculateStats(allYields);
        const zScore = DataTransformer.zScore(stockData.dividendYield, stats.mean, stats.stdDev);
        const yieldScore = SCORING_CONFIG.BASE_SCORE + 25 * zScore; // Positive z-score is better
        score += Math.max(0, Math.min(100, yieldScore));
        components++;
      }
    }

    return components > 0 ? score / (components + 1) : SCORING_CONFIG.BASE_SCORE;
  }

  private calculateGrowthScore(stockData: any, allData: any[]): number {
    if (!stockData) return SCORING_CONFIG.BASE_SCORE;

    let score = SCORING_CONFIG.BASE_SCORE;
    let components = 0;

    // Revenue YoY score (higher is better)
    if (stockData.yoy !== undefined) {
      const allYoys = allData
        .map(item => item.yoy)
        .filter(yoy => yoy !== undefined);

      if (allYoys.length > 0) {
        const stats = DataTransformer.calculateStats(allYoys);
        const zScore = DataTransformer.zScore(stockData.yoy, stats.mean, stats.stdDev);
        const yoyScore = SCORING_CONFIG.BASE_SCORE + 30 * zScore;
        score += Math.max(0, Math.min(100, yoyScore));
        components++;
      }
    }

    // Revenue MoM score (higher is better)
    if (stockData.mom !== undefined) {
      const allMoms = allData
        .map(item => item.mom)
        .filter(mom => mom !== undefined);

      if (allMoms.length > 0) {
        const stats = DataTransformer.calculateStats(allMoms);
        const zScore = DataTransformer.zScore(stockData.mom, stats.mean, stats.stdDev);
        const momScore = SCORING_CONFIG.BASE_SCORE + 30 * zScore;
        score += Math.max(0, Math.min(100, momScore));
        components++;
      }
    }

    // EPS QoQ score (higher is better)
    if (stockData.epsQoQ !== undefined) {
      const allEpsQoQ = allData
        .map(item => item.epsQoQ)
        .filter(eps => eps !== undefined);

      if (allEpsQoQ.length > 0) {
        const stats = DataTransformer.calculateStats(allEpsQoQ);
        const zScore = DataTransformer.zScore(stockData.epsQoQ, stats.mean, stats.stdDev);
        const epsScore = SCORING_CONFIG.BASE_SCORE + 40 * zScore;
        score += Math.max(0, Math.min(100, epsScore));
        components++;
      }
    }

    return components > 0 ? score / (components + 1) : SCORING_CONFIG.BASE_SCORE;
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }
}
