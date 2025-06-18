#!/usr/bin/env node
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';

export async function run(): Promise<void> {
  const valuation = new ValuationFetcher();
  await valuation.initialize();
  await valuation.fetchValuationData();
  await valuation.close();

  const growth = new GrowthFetcher();
  await growth.initialize();
  await growth.fetchRevenueData();
  await growth.fetchEpsData();
  await growth.close();

  const quality = new QualityFetcher();
  await quality.initialize();
  await quality.fetchQualityMetrics('2330', '2020-01-01');
  await quality.close();

  const fund = new FundFlowFetcher();
  await fund.initialize();
  await fund.fetchFundFlowData();
  await fund.close();

  const momentum = new MomentumFetcher();
  await momentum.initialize();
  await momentum.fetchMomentumData(['2330']);
  await momentum.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
