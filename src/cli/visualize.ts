#!/usr/bin/env node

import { Visualizer } from '../services/visualizer.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';

interface VisualizeArgs {
  type: 'top' | 'distribution' | 'comparison' | 'trend' | 'summary';
  stocks?: string;
  factor?: string;
  limit?: number;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('type', {
      alias: 't',
      describe: '圖表類型',
      choices: ['top', 'distribution', 'comparison', 'trend', 'summary'],
      default: 'summary'
    })
    .option('stocks', {
      alias: 's',
      describe: '股票代號 (用逗號分隔)',
      type: 'string'
    })
    .option('factor', {
      alias: 'f',
      describe: '因子類型',
      choices: ['valuation', 'growth', 'quality', 'fund-flow', 'momentum'],
      type: 'string'
    })
    .option('limit', {
      alias: 'l',
      describe: '顯示數量限制',
      type: 'number',
      default: 20
    })
    .help()
    .parseAsync() as VisualizeArgs;

  const visualizer = new Visualizer();

  try {
    await ErrorHandler.initialize();
    const initSpinner = ora('初始化視覺化工具...').start();
    await visualizer.initialize();
    initSpinner.succeed('初始化完成');

    switch (argv.type) {
      case 'top':
        await showTopStocks(visualizer, argv.limit || 20);
        break;

      case 'distribution':
        await showDistribution(visualizer);
        break;

      case 'comparison':
        if (!argv.stocks) {
          console.error('❌ 比較圖表需要指定股票代號 (--stocks)');
          process.exit(1);
        }
        await showComparison(visualizer, argv.stocks.split(','));
        break;

      case 'trend':
        if (!argv.stocks || !argv.factor) {
          console.error('❌ 趨勢圖表需要指定股票代號 (--stocks) 和因子 (--factor)');
          process.exit(1);
        }
        await showTrend(visualizer, argv.stocks.split(',')[0]!, argv.factor!);
        break;

      case 'summary':
      default:
        await showSummary(visualizer);
        break;
    }

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'visualize');
    console.error('❌ 視覺化錯誤:', (error as Error).message);
    process.exit(1);
  } finally {
    await visualizer.close();
  }
}

async function showTopStocks(visualizer: Visualizer, limit: number) {
  console.log(`🏆 前 ${limit} 名高潛力股票排行榜`);
  const spin = ora('產生圖表...').start();
  const chartData = await visualizer.generateTopStocksChart(limit);
  spin.succeed('完成');
  const chart = visualizer.generateASCIIChart(chartData);
  console.log(chart);
}

async function showDistribution(visualizer: Visualizer) {
  console.log('📊 總分分布圖');
  const spin = ora('產生圖表...').start();
  const chartData = await visualizer.generateScoreDistributionChart();
  spin.succeed('完成');
  const chart = visualizer.generateASCIIChart(chartData);
  console.log(chart);
}

async function showComparison(visualizer: Visualizer, stockNos: string[]) {
  console.log(`📈 多股票因子比較: ${stockNos.join(', ')}`);
  const spin = ora('產生圖表...').start();
  const chartDataList = await visualizer.generateFactorComparisonChart(stockNos);
  spin.succeed('完成');

  for (const chartData of chartDataList) {
    const chart = visualizer.generateASCIIChart(chartData);
    console.log(chart);
    console.log(''); // 空行分隔
  }
}

async function showTrend(visualizer: Visualizer, stockNo: string, factor: string) {
  console.log(`📈 ${stockNo} ${factor} 趨勢圖`);
  const spin = ora('產生圖表...').start();
  const chartData = await visualizer.generateTimeSeriesChart(stockNo, factor);
  spin.succeed('完成');
  const chart = visualizer.generateASCIIChart(chartData);
  console.log(chart);
}

async function showSummary(visualizer: Visualizer) {
  const spin = ora('產生報告...').start();
  const summary = await visualizer.generateSummaryReport();
  spin.succeed('完成');
  console.log(summary);

  // 顯示前10名股票
  console.log('\n🏆 前 10 名高潛力股票:');
  const topSpin = ora('產生圖表...').start();
  const topChart = await visualizer.generateTopStocksChart(10);
  topSpin.succeed('完成');
  const chart = visualizer.generateASCIIChart(topChart);
  console.log(chart);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
