#!/usr/bin/env node
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';

export async function run(): Promise<void> {
  await ErrorHandler.initialize();
  const valuation = new ValuationFetcher();
  const growth = new GrowthFetcher();
  const quality = new QualityFetcher();
  const fund = new FundFlowFetcher();
  const momentum = new MomentumFetcher();

  await Promise.all([
    (async () => {
      try {
        const spin = ora('Valuation').start();
        await valuation.initialize();
        await valuation.fetchValuationData();
        spin.succeed('Valuation 完成');
      } catch (err) {
        spin.fail('Valuation 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:valuation');
        console.error('Valuation fetcher failed');
      } finally {
        await valuation.close();
      }
    })(),
    (async () => {
      try {
        const spin = ora('Growth').start();
        await growth.initialize();
        await growth.fetchRevenueData();
        await growth.fetchEpsData();
        spin.succeed('Growth 完成');
      } catch (err) {
        spin.fail('Growth 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:growth');
        console.error('Growth fetcher failed');
      } finally {
        await growth.close();
      }
    })(),
    (async () => {
      try {
        const spin = ora('Quality').start();
        await quality.initialize();
        await quality.fetchQualityMetrics('2330', '2020-01-01');
        spin.succeed('Quality 完成');
      } catch (err) {
        spin.fail('Quality 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:quality');
        console.error('Quality fetcher failed');
      } finally {
        await quality.close();
      }
    })(),
    (async () => {
      try {
        const spin = ora('Fund flow').start();
        await fund.initialize();
        await fund.fetchFundFlowData();
        spin.succeed('Fund flow 完成');
      } catch (err) {
        spin.fail('Fund flow 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:fund-flow');
        console.error('Fund flow fetcher failed');
      } finally {
        await fund.close();
      }
    })(),
    (async () => {
      try {
        const spin = ora('Momentum').start();
        await momentum.initialize();
        await momentum.fetchMomentumData(['2330']);
        spin.succeed('Momentum 完成');
      } catch (err) {
        spin.fail('Momentum 失敗');
        await ErrorHandler.logError(err as Error, 'fetch-all:momentum');
        console.error('Momentum fetcher failed');
      } finally {
        await momentum.close();
      }
    })(),
  ]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
