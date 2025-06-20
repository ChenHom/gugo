#!/usr/bin/env node

import { Visualizer } from '../services/visualizer.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

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

  await ErrorHandler.initialize();
  const initSpinner = ora('初始化視覺化工具...').start();

  try {
    await visualizer.initialize();
    initSpinner.succeed('初始化完成');

    switch (argv.type) {
      case 'top': {
        const spinner = ora('生成排行榜...').start();
        await showTopStocks(visualizer, argv.limit || 20);
        spinner.succeed('完成');
        break;
      }

      case 'distribution': {
        const spinner = ora('生成分布圖...').start();
        await showDistribution(visualizer);
        spinner.succeed('完成');
        break;
      }

      case 'comparison': {
        if (!argv.stocks) {
          console.error('❌ 比較圖表需要指定股票代號 (--stocks)');
          process.exit(1);
        }
        const cmpSpinner = ora('生成比較圖...').start();
        await showComparison(visualizer, argv.stocks.split(','));
        cmpSpinner.succeed('完成');
        break;
      }

      case 'trend': {
        if (!argv.stocks || !argv.factor) {
          console.error('❌ 趨勢圖表需要指定股票代號 (--stocks) 和因子 (--factor)');
          process.exit(1);
        }
        const trendSpinner = ora('生成趨勢圖...').start();
        await showTrend(visualizer, argv.stocks.split(',')[0]!, argv.factor!);
        trendSpinner.succeed('完成');
        break;
      }

      case 'summary':
      default: {
        const spinner = ora('生成摘要...').start();
        await showSummary(visualizer);
        spinner.succeed('完成');
        break;
      }
    }
  } catch (error) {
    await ErrorHandler.logError(error as Error, 'visualize');
    console.error('❌ 視覺化錯誤');
    process.exit(1);
  } finally {
    await visualizer.close();
  }
}

async function showTopStocks(visualizer: Visualizer, limit: number) {
  console.log(`🏆 前 ${limit} 名高潛力股票排行榜`);
  const chartData = await visualizer.generateTopStocksChart(limit);
  const chart = visualizer.generateASCIIChart(chartData);
  console.log(chart);
}

async function showDistribution(visualizer: Visualizer) {
  console.log('📊 總分分布圖');
  const chartData = await visualizer.generateScoreDistributionChart();
  const chart = visualizer.generateASCIIChart(chartData);
  console.log(chart);
}

async function showComparison(visualizer: Visualizer, stockNos: string[]) {
  console.log(`📈 多股票因子比較: ${stockNos.join(', ')}`);
  const chartDataList = await visualizer.generateFactorComparisonChart(stockNos);

  for (const chartData of chartDataList) {
    const chart = visualizer.generateASCIIChart(chartData);
    console.log(chart);
    console.log(''); // 空行分隔
  }
}

async function showTrend(visualizer: Visualizer, stockNo: string, factor: string) {
  console.log(`📈 ${stockNo} ${factor} 趨勢圖`);
  const chartData = await visualizer.generateTimeSeriesChart(stockNo, factor);
  const chart = visualizer.generateASCIIChart(chartData);
  console.log(chart);
}

async function showSummary(visualizer: Visualizer) {
  const summary = await visualizer.generateSummaryReport();
  console.log(summary);

  // 顯示前10名股票
  console.log('\n🏆 前 10 名高潛力股票:');
  const topChart = await visualizer.generateTopStocksChart(10);
  const chart = visualizer.generateASCIIChart(topChart);
  console.log(chart);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
