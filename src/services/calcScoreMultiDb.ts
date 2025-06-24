import { getMultiDbManager } from './multiDbManager.js';
import { SubScores, ScoreResult, DEFAULT_SUB_WEIGHTS } from '../types/index.js';

export interface CalcScoreOptions {
  weights?: Partial<SubScores>;
  method?: 'zscore' | 'percentile' | 'rolling';
  window?: number;
}

function zScore(value: number, values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  return stdDev === 0 ? 0 : (value - mean) / stdDev;
}

function percentileRank(value: number, values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex(v => v >= value);
  return index === -1 ? 100 : (index / sorted.length) * 100;
}

function average(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
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

export async function calcScoreMultiDb(
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
  const dbManager = getMultiDbManager();

  // === 估值分數 ===
  const valRowsAll = dbManager.queryValuation<any>('SELECT stock_no, per, pbr, dividend_yield, date FROM valuation');
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
      countVal++;
    } else missing.push('per');

    if (stockPbr !== undefined && pbrVals.length) {
      valuation += scoreMetric(stockPbr, pbrVals, false, usePercentile);
      countVal++;
    } else missing.push('pbr');

    if (stockDy !== undefined && dyVals.length) {
      valuation += scoreMetric(stockDy, dyVals, true, usePercentile);
      countVal++;
    } else missing.push('dividend_yield');
  } else {
    missing.push('valuation');
  }
  valuation = countVal ? valuation / countVal : 0;

  // === 成長分數 ===
  const grRowsAll = dbManager.queryGrowth<any>('SELECT stock_id as stock_no, yoy, mom, eps_qoq, month FROM growth_metrics');
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

    if (stockYoy !== undefined && yoyVals.length) {
      growth += scoreMetric(stockYoy, yoyVals, true, usePercentile);
      countGr++;
    } else missing.push('yoy');

    if (stockMom !== undefined && momVals.length) {
      growth += scoreMetric(stockMom, momVals, true, usePercentile);
      countGr++;
    } else missing.push('mom');

    if (stockEps !== undefined && epsVals.length) {
      growth += scoreMetric(stockEps, epsVals, true, usePercentile);
      countGr++;
    } else missing.push('eps_qoq');
  } else {
    missing.push('growth');
  }
  growth = countGr ? growth / countGr : 0;

  // === 品質分數 ===
  const qRowsAll = dbManager.queryQuality<any>('SELECT stock_id as stock_no, roe, gross_margin, operating_margin as op_margin, date FROM quality_metrics');
  const latestQDate = qRowsAll.reduce((d, r) => (d > r.date ? d : r.date), '');
  const qRows = qRowsAll.filter(r => r.date === latestQDate);
  const qStockHistory = qRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
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

    if (stockRoe !== undefined && roeVals.length) {
      quality += scoreMetric(stockRoe, roeVals, true, usePercentile);
      countQ++;
    } else missing.push('roe');

    if (stockGm !== undefined && gmVals.length) {
      quality += scoreMetric(stockGm, gmVals, true, usePercentile);
      countQ++;
    } else missing.push('gross_margin');

    if (stockOp !== undefined && opVals.length) {
      quality += scoreMetric(stockOp, opVals, true, usePercentile);
      countQ++;
    } else missing.push('op_margin');
  } else {
    missing.push('quality');
  }
  quality = countQ ? quality / countQ : 0;

  // === 資金流向分數 ===
  const chipRowsAll = dbManager.queryFundFlow<any>('SELECT stock_id as stock_no, foreign_net, inv_trust_net, date FROM fund_flow_metrics');
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

    if (stockFr !== undefined && frVals.length) {
      chips += scoreMetric(stockFr, frVals, true, usePercentile);
      countC++;
    } else missing.push('foreign_net');

    if (stockIt !== undefined && itVals.length) {
      chips += scoreMetric(stockIt, itVals, true, usePercentile);
      countC++;
    } else missing.push('inv_trust_net');
  } else {
    missing.push('chips');
  }
  chips = countC ? chips / countC : 0;

  // === 動能分數 ===
  const moRowsAll = dbManager.queryMomentum<any>('SELECT stock_no, rsi, ma_20, ma_60, price_change_1m, date FROM momentum_metrics');
  const latestMoDate = moRowsAll.reduce((d, r) => (d > r.date ? d : r.date), '');
  const moRows = moRowsAll.filter(r => r.date === latestMoDate);
  const moStockHistory = moRowsAll
    .filter(r => r.stock_no === stockNo)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
  const moStock = moStockHistory[0];
  let momentum = 0;

  if (moStock && moRows.length) {
    const usePercentile = method === 'percentile';
    const rolling = method === 'rolling';

    // 使用 RSI 和價格變化作為動能指標
    const rsiVals = moRows.map(r => r.rsi).filter((v): v is number => typeof v === 'number');
    const priceChangeVals = moRows.map(r => r.price_change_1m).filter((v): v is number => typeof v === 'number');

    let momentumComponents = 0;
    let momentumCount = 0;

    if (moStock.rsi !== undefined && rsiVals.length) {
      const stockRsi = rolling
        ? average(moStockHistory.slice(0, window).map(r => r.rsi).filter((v): v is number => typeof v === 'number'))
        : moStock.rsi;
      if (stockRsi !== undefined) {
        momentumComponents += scoreMetric(stockRsi, rsiVals, true, usePercentile);
        momentumCount++;
      }
    }

    if (moStock.price_change_1m !== undefined && priceChangeVals.length) {
      const stockPriceChange = rolling
        ? average(moStockHistory.slice(0, window).map(r => r.price_change_1m).filter((v): v is number => typeof v === 'number'))
        : moStock.price_change_1m;
      if (stockPriceChange !== undefined) {
        momentumComponents += scoreMetric(stockPriceChange, priceChangeVals, true, usePercentile);
        momentumCount++;
      }
    }

    momentum = momentumCount > 0 ? momentumComponents / momentumCount : 0;
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
