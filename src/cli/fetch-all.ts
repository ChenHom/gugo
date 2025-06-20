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

  try {
    const valuation = new ValuationFetcher();
    const valSpinner = ora('抓取估值資料...').start();
    await valuation.initialize();
    await valuation.fetchValuationData();
    await valuation.close();
    valSpinner.succeed('估值資料完成');

    const growth = new GrowthFetcher();
    const growthSpinner = ora('抓取成長資料...').start();
    await growth.initialize();
    await growth.fetchRevenueData();
    await growth.fetchEpsData();
    await growth.close();
    growthSpinner.succeed('成長資料完成');

    const quality = new QualityFetcher();
    const qualitySpinner = ora('抓取品質資料...').start();
    await quality.initialize();
    await quality.fetchQualityMetrics('2330', '2020-01-01');
    await quality.close();
    qualitySpinner.succeed('品質資料完成');

    const fund = new FundFlowFetcher();
    const fundSpinner = ora('抓取資金流資料...').start();
    await fund.initialize();
    await fund.fetchFundFlowData();
    await fund.close();
    fundSpinner.succeed('資金流資料完成');

    const momentum = new MomentumFetcher();
    const momSpinner = ora('抓取動能資料...').start();
    await momentum.initialize();
    await momentum.fetchMomentumData(['2330']);
    await momentum.close();
    momSpinner.succeed('動能資料完成');

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'fetch-all');
    console.error('❌ 抓取資料時發生錯誤');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
