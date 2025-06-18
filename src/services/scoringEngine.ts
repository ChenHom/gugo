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

import { query } from '../db.js';
import { SubScores, ScoreResult, DEFAULT_SUB_WEIGHTS } from '../types/index.js';

export interface CalcScoreOptions {
  weights?: Partial<SubScores>;
  method?: 'zscore' | 'percentile' | 'rolling';
  window?: number;
}

function zScore(value: number, values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (value - mean) / std;
}

function percentileRank(value: number, values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const v of sorted) {
    if (v <= value) count++;
    else break;
  }
  return (count / sorted.length) * 100;
}

function average(arr: number[]): number {
  if (!arr.length) return NaN;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function scoreMetric(value: number | undefined, values: number[], higher: boolean, usePercentile: boolean): number {
  if (value === undefined || values.length === 0 || Number.isNaN(value)) return 0;
  if (usePercentile) {
    const rank = percentileRank(value, values);
    return clamp(higher ? rank : 100 - rank);
  }
  const z = zScore(value, values);
  const base = 50 + (higher ? z * 10 : -z * 10);
  return clamp(base);
}

export async function calcScore(
  stockNo: string,
  options: CalcScoreOptions = {}
): Promise<ScoreResult> {
  const { weights = {}, method = 'zscore', window = 3 } = options;
  const w: SubScores = { ...DEFAULT_SUB_WEIGHTS, ...weights };
  const totalW = w.valuation + w.growth + w.quality + w.chips + w.momentum;
  w.valuation /= totalW;
  w.growth /= totalW;
  w.quality /= totalW;
  w.chips /= totalW;
  w.momentum /= totalW;

  const missing: string[] = [];

  const valRowsAll = query<any>('SELECT stock_no, per, pbr, dividend_yield, date FROM valuation');
  const latestValDate = valRowsAll.reduce((d, r) => (d > r.date ? d : r.date), '');
  const valRows = valRowsAll.filter(r => r.date === latestValDate);
  const valStockHistory = valRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  const valStock = valStockHistory[0];
  const perVals = valRows.map(r => r.per).filter((v): v is number => typeof v === 'number');
  const pbrVals = valRows.map(r => r.pbr).filter((v): v is number => typeof v === 'number');
  const dyVals = valRows.map(r => r.dividend_yield).filter((v): v is number => typeof v === 'number');
  let valuation = 0;
  let countVal = 0;
  if (valStock) {
    const usePercentile = method === 'percentile';
    const rolling = method === 'rolling';
    const stockPer = rolling
      ? average(valStockHistory.slice(0, window).map(r => r.per).filter((v): v is number => typeof v === 'number'))
      : valStock.per;
    const stockPbr = rolling
      ? average(valStockHistory.slice(0, window).map(r => r.pbr).filter((v): v is number => typeof v === 'number'))
      : valStock.pbr;
    const stockDy = rolling
      ? average(valStockHistory.slice(0, window).map(r => r.dividend_yield).filter((v): v is number => typeof v === 'number'))
      : valStock.dividend_yield;

    if (stockPer !== undefined && perVals.length) {
      valuation += scoreMetric(stockPer, perVals, false, usePercentile);
      countVal++; }
    else missing.push('per');
    if (stockPbr !== undefined && pbrVals.length) {
      valuation += scoreMetric(stockPbr, pbrVals, false, usePercentile);
      countVal++; }
    else missing.push('pbr');
    if (stockDy !== undefined && dyVals.length) {
      valuation += scoreMetric(stockDy, dyVals, true, usePercentile);
      countVal++; }
    else missing.push('dividend_yield');
  } else {
    missing.push('valuation');
  }
  valuation = countVal ? valuation / countVal : 0;

  const grRowsAll = query<any>('SELECT stock_no, yoy, mom, eps_qoq, month FROM growth');
  const latestGrMonth = grRowsAll.reduce((d, r) => (d > r.month ? d : r.month), '');
  const grRows = grRowsAll.filter(r => r.month === latestGrMonth);
  const grStockHistory = grRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => (b.month > a.month ? 1 : -1));
  const grStock = grStockHistory[0];
  const yoyVals = grRows.map(r => r.yoy).filter((v): v is number => typeof v === 'number');
  const momVals = grRows.map(r => r.mom).filter((v): v is number => typeof v === 'number');
  const epsVals = grRows.map(r => r.eps_qoq).filter((v): v is number => typeof v === 'number');
  let growth = 0;
  let countGr = 0;
  if (grStock) {
    const usePercentile = method === 'percentile';
    const rolling = method === 'rolling';
    const stockYoy = rolling
      ? average(grStockHistory.slice(0, window).map(r => r.yoy).filter((v): v is number => typeof v === 'number'))
      : grStock.yoy;
    const stockMom = rolling
      ? average(grStockHistory.slice(0, window).map(r => r.mom).filter((v): v is number => typeof v === 'number'))
      : grStock.mom;
    const stockEps = rolling
      ? average(grStockHistory.slice(0, window).map(r => r.eps_qoq).filter((v): v is number => typeof v === 'number'))
      : grStock.eps_qoq;
    if (stockYoy !== undefined && yoyVals.length) { growth += scoreMetric(stockYoy, yoyVals, true, usePercentile); countGr++; } else missing.push('yoy');
    if (stockMom !== undefined && momVals.length) { growth += scoreMetric(stockMom, momVals, true, usePercentile); countGr++; } else missing.push('mom');
    if (stockEps !== undefined && epsVals.length) { growth += scoreMetric(stockEps, epsVals, true, usePercentile); countGr++; } else missing.push('eps_qoq');
  } else {
    missing.push('growth');
  }
  growth = countGr ? growth / countGr : 0;

  const qRowsAll = query<any>('SELECT stock_no, roe, gross_margin, op_margin, year FROM quality');
  const latestQYear = qRowsAll.reduce((d, r) => (d > r.year ? d : r.year), 0);
  const qRows = qRowsAll.filter(r => r.year === latestQYear);
  const qStockHistory = qRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => b.year - a.year);
  const qStock = qStockHistory[0];
  const roeVals = qRows.map(r => r.roe).filter((v): v is number => typeof v === 'number');
  const gmVals = qRows.map(r => r.gross_margin).filter((v): v is number => typeof v === 'number');
  const opVals = qRows.map(r => r.op_margin).filter((v): v is number => typeof v === 'number');
  let quality = 0;
  let countQ = 0;
  if (qStock) {
    const usePercentile = method === 'percentile';
    const rolling = method === 'rolling';
    const stockRoe = rolling
      ? average(qStockHistory.slice(0, window).map(r => r.roe).filter((v): v is number => typeof v === 'number'))
      : qStock.roe;
    const stockGm = rolling
      ? average(qStockHistory.slice(0, window).map(r => r.gross_margin).filter((v): v is number => typeof v === 'number'))
      : qStock.gross_margin;
    const stockOp = rolling
      ? average(qStockHistory.slice(0, window).map(r => r.op_margin).filter((v): v is number => typeof v === 'number'))
      : qStock.op_margin;
    if (stockRoe !== undefined && roeVals.length) { quality += scoreMetric(stockRoe, roeVals, true, usePercentile); countQ++; } else missing.push('roe');
    if (stockGm !== undefined && gmVals.length) { quality += scoreMetric(stockGm, gmVals, true, usePercentile); countQ++; } else missing.push('gross_margin');
    if (stockOp !== undefined && opVals.length) { quality += scoreMetric(stockOp, opVals, true, usePercentile); countQ++; } else missing.push('op_margin');
  } else {
    missing.push('quality');
  }
  quality = countQ ? quality / countQ : 0;

  const chipRowsAll = query<any>('SELECT stock_no, foreign_net, inv_trust_net, date FROM fundflow');
  const latestChipDate = chipRowsAll.reduce((d, r) => (d > r.date ? d : r.date), '');
  const chipRows = chipRowsAll.filter(r => r.date === latestChipDate);
  const chipStockHistory = chipRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  const chipStock = chipStockHistory[0];
  const frVals = chipRows.map(r => r.foreign_net).filter((v): v is number => typeof v === 'number');
  const itVals = chipRows.map(r => r.inv_trust_net).filter((v): v is number => typeof v === 'number');
  let chips = 0;
  let countC = 0;
  if (chipStock) {
    const usePercentile = method === 'percentile';
    const rolling = method === 'rolling';
    const stockFr = rolling
      ? average(chipStockHistory.slice(0, window).map(r => r.foreign_net).filter((v): v is number => typeof v === 'number'))
      : chipStock.foreign_net;
    const stockIt = rolling
      ? average(chipStockHistory.slice(0, window).map(r => r.inv_trust_net).filter((v): v is number => typeof v === 'number'))
      : chipStock.inv_trust_net;
    if (stockFr !== undefined && frVals.length) { chips += scoreMetric(stockFr, frVals, true, usePercentile); countC++; } else missing.push('foreign_net');
    if (stockIt !== undefined && itVals.length) { chips += scoreMetric(stockIt, itVals, true, usePercentile); countC++; } else missing.push('inv_trust_net');
  } else {
    missing.push('chips');
  }
  chips = countC ? chips / countC : 0;

  const moRowsAll = query<any>('SELECT stock_no, close, date FROM price_daily');
  const latestMoDate = moRowsAll.reduce((d, r) => (d > r.date ? d : r.date), '');
  const moRows = moRowsAll.filter(r => r.date === latestMoDate);
  const moStockHistory = moRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  const moStock = moStockHistory[0];
  const closeVals = moRows.map(r => r.close).filter((v): v is number => typeof v === 'number');
  let momentum = 0;
  if (moStock && closeVals.length) {
    const usePercentile = method === 'percentile';
    const rolling = method === 'rolling';
    const stockClose = rolling
      ? average(moStockHistory.slice(0, window).map(r => r.close).filter((v): v is number => typeof v === 'number'))
      : moStock.close;
    if (stockClose !== undefined) {
      momentum = scoreMetric(stockClose, closeVals, true, usePercentile);
    }
    else missing.push('momentum');
  } else {
    missing.push('momentum');
  }

  const total =
    valuation * w.valuation +
    growth * w.growth +
    quality * w.quality +
    chips * w.chips +
    momentum * w.momentum;

  return { total, valuation, growth, quality, chips, momentum, missing };
}
