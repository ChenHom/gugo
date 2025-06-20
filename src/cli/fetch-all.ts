#!/usr/bin/env node
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';

export async function run(): Promise<void> {
  const valuation = new ValuationFetcher();
  const growth = new GrowthFetcher();
  const quality = new QualityFetcher();
  const fund = new FundFlowFetcher();
  const momentum = new MomentumFetcher();

  await Promise.all([
    (async () => {
      try {
        await valuation.initialize();
        await valuation.fetchValuationData();
      } catch (err) {
        console.error('Valuation fetcher failed:', err);
      } finally {
        await valuation.close();
      }
    })(),
    (async () => {
      try {
        await growth.initialize();
        await growth.fetchRevenueData();
        await growth.fetchEpsData();
      } catch (err) {
        console.error('Growth fetcher failed:', err);
      } finally {
        await growth.close();
      }
    })(),
    (async () => {
      try {
        await quality.initialize();
        await quality.fetchQualityMetrics('2330', '2020-01-01');
      } catch (err) {
        console.error('Quality fetcher failed:', err);
      } finally {
        await quality.close();
      }
    })(),
    (async () => {
      try {
        await fund.initialize();
        await fund.fetchFundFlowData();
      } catch (err) {
        console.error('Fund flow fetcher failed:', err);
      } finally {
        await fund.close();
      }
    })(),
    (async () => {
      try {
        await momentum.initialize();
        await momentum.fetchMomentumData(['2330']);
      } catch (err) {
        console.error('Momentum fetcher failed:', err);
      } finally {
        await momentum.close();
      }
    })(),
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
