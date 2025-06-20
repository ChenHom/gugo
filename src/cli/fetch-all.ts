#!/usr/bin/env node
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

export async function run(): Promise<void> {
  await ErrorHandler.initialize();

  const valuation = new ValuationFetcher();
  const growth = new GrowthFetcher();
  const quality = new QualityFetcher();
  const fund = new FundFlowFetcher();
  const momentum = new MomentumFetcher();

  const tasks = [
    (async () => {
      const spinner = ora('抓取估值資料...').start();
      try {
        await valuation.initialize();
        await valuation.fetchValuationData();
        spinner.succeed('估值資料完成');
      } catch (err) {
        spinner.fail('估值資料抓取失敗');
        await ErrorHandler.logError(err as Error, 'fetch-valuation');
      } finally {
        await valuation.close();
      }
    })(),
    (async () => {
      const spinner = ora('抓取成長資料...').start();
      try {
        await growth.initialize();
        await growth.fetchRevenueData();
        await growth.fetchEpsData();
        spinner.succeed('成長資料完成');
      } catch (err) {
        spinner.fail('成長資料抓取失敗');
        await ErrorHandler.logError(err as Error, 'fetch-growth');
      } finally {
        await growth.close();
      }
    })(),
    (async () => {
      const spinner = ora('抓取品質資料...').start();
      try {
        await quality.initialize();
        await quality.fetchQualityMetrics('2330', '2020-01-01');
        spinner.succeed('品質資料完成');
      } catch (err) {
        spinner.fail('品質資料抓取失敗');
        await ErrorHandler.logError(err as Error, 'fetch-quality');
      } finally {
        await quality.close();
      }
    })(),
    (async () => {
      const spinner = ora('抓取資金流資料...').start();
      try {
        await fund.initialize();
        await fund.fetchFundFlowData();
        spinner.succeed('資金流資料完成');
      } catch (err) {
        spinner.fail('資金流資料抓取失敗');
        await ErrorHandler.logError(err as Error, 'fetch-fund-flow');
      } finally {
        await fund.close();
      }
    })(),
    (async () => {
      const spinner = ora('抓取動能資料...').start();
      try {
        await momentum.initialize();
        await momentum.fetchMomentumData(['2330']);
        spinner.succeed('動能資料完成');
      } catch (err) {
        spinner.fail('動能資料抓取失敗');
        await ErrorHandler.logError(err as Error, 'fetch-momentum');
      } finally {
        await momentum.close();
      }
    })(),
  ];

  await Promise.all(tasks);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
