#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { backtestMA } from '../backtest/maStrategy.js';
import { backtestMulti, TopNStrategy, ThresholdStrategy } from '../backtest/multiStrategy.js';
import { query } from '../db.js';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('stock', { type: 'string' })
    .option('strategy', {
      type: 'string',
      choices: ['ma', 'top_n', 'threshold'],
      default: 'ma',
    })
    .option('n', { type: 'number', default: 5 })
    .option('threshold', { type: 'number', default: 70 })
    .option('rebalance', { type: 'number', default: 20 })
    .help()
    .parseSync();

  await ErrorHandler.initialize();
  const spinner = ora('執行回測中...').start();
  try {
    let res: { annualReturn: number; sharpe: number; maxDrawdown: number };

    if (argv.strategy === 'ma') {
      if (!argv.stock) throw new Error('stock required for ma strategy');
      res = await backtestMA(argv.stock);
    } else {
      const priceRows = query<any>('SELECT stock_no, date, close FROM price_daily ORDER BY date');
      const prices: Record<string, { date: string; close: number }[]> = {};
      for (const row of priceRows) {
        if (!prices[row.stock_no]) prices[row.stock_no] = [];
        prices[row.stock_no]!.push({ date: row.date, close: row.close });
      }

      const scoreRows = query<any>('SELECT stock_no, date, total_score FROM scores ORDER BY date');
      const scores: Record<string, number[]> = {};
      for (const r of scoreRows) {
        if (!scores[r.stock_no]) scores[r.stock_no] = [];
        scores[r.stock_no]!.push(r.total_score);
      }

      let strategy;
      if (argv.strategy === 'top_n') {
        strategy = new TopNStrategy(scores, argv.n);
      } else {
        strategy = new ThresholdStrategy(scores, argv.threshold);
      }

      res = backtestMulti(prices, strategy, { rebalance: argv.rebalance });
    }

    spinner.succeed('回測完成');
    console.log(`Annual Return: ${(res.annualReturn * 100).toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${res.sharpe.toFixed(2)}`);
    console.log(`Max Drawdown: ${(res.maxDrawdown * 100).toFixed(2)}%`);
  } catch (error) {
    spinner.fail('回測失敗');
    await ErrorHandler.logError(error as Error, 'backtest');
    console.error('❌ 回測失敗');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
