#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import ora from 'ora';
import { query } from '../db.js';
import { backtestMA } from '../backtest/maStrategy.js';
import { backtestMulti, TopNStrategy, ThresholdStrategy } from '../backtest/multiStrategy.js';
import { RankRow } from '../services/portfolioBuilder.js';
import { backtest } from '../services/backtest.js';
import { CostModel } from '../models/CostModel.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  try {
    await ErrorHandler.initialize();
    const argv = yargs(args)
      .option('stock', { type: 'string' })
      .option('strategy', {
        type: 'string',
        choices: ['ma', 'top_n', 'threshold', 'rank'] as const,
        default: 'ma',
      })
      .option('n', { type: 'number', default: 5 })
      .option('threshold', { type: 'number', default: 70 })
      .option('rebalance', { type: 'number', default: 20 })
      .option('start', { type: 'string' })
      .option('top', { type: 'number', default: 10 })
      .option('mode', { choices: ['equal', 'cap'] as const, default: 'equal' })
      .help()
      .parseSync();

    if (argv.strategy === 'ma') {
      if (!argv.stock) throw new Error('stock required for ma strategy');
      const spin = ora('執行回測...').start();
      const res = await backtestMA(argv.stock);
      spin.succeed('回測完成');
      console.log(`Annual Return: ${(res.annualReturn * 100).toFixed(2)}%`);
      console.log(`Sharpe Ratio: ${res.sharpe.toFixed(2)}`);
      console.log(`Max Drawdown: ${(res.maxDrawdown * 100).toFixed(2)}%`);
      return;
    }

    if (argv.strategy === 'rank') {
      if (!argv.start) throw new Error('start date required for rank strategy');
      const scoreRows = query<any>(
        'SELECT date, stock_no, total_score, market_value FROM stock_scores ORDER BY date'
      );
      const ranks: RankRow[] = scoreRows.map((r: any) => ({
        date: r.date,
        stock: r.stock_no,
        score: r.total_score,
        marketCap: r.market_value,
      }));
      const priceRows = query<any>(
        'SELECT stock_no, date, close FROM price_daily ORDER BY date'
      );
      const prices: Record<string, { date: string; close: number }[]> = {};
      for (const row of priceRows) {
        if (!prices[row.stock_no]) prices[row.stock_no] = [];
        prices[row.stock_no].push({ date: row.date, close: row.close });
      }
      const spin = ora('執行回測...').start();
      const res = backtest(ranks, prices, {
        start: argv.start,
        rebalance: argv.rebalance,
        top: argv.top,
        mode: argv.mode,
        costModel: new CostModel(),
      });
      spin.succeed('回測完成');
      console.log(`CAGR: ${(res.cagr * 100).toFixed(2)}%`);
      console.log(`Sharpe: ${res.sharpe.toFixed(2)}`);
      console.log(`MDD: ${(res.mdd * 100).toFixed(2)}%`);
      return;
    }

    const priceRows = query<any>(
      'SELECT stock_no, date, close FROM price_daily ORDER BY date'
    );
    const prices: Record<string, { date: string; close: number }[]> = {};
    for (const row of priceRows) {
      if (!prices[row.stock_no]) prices[row.stock_no] = [];
      prices[row.stock_no].push({ date: row.date, close: row.close });
    }

    const scoreRows = query<any>(
      'SELECT stock_no, date, total_score FROM scores ORDER BY date'
    );
    const scores: Record<string, number[]> = {};
    for (const r of scoreRows) {
      if (!scores[r.stock_no]) scores[r.stock_no] = [];
      scores[r.stock_no].push(r.total_score);
    }

    let strategy;
    if (argv.strategy === 'top_n') {
      strategy = new TopNStrategy(scores, argv.n);
    } else {
      strategy = new ThresholdStrategy(scores, argv.threshold);
    }

    const spin = ora('執行回測...').start();
    const res = backtestMulti(prices, strategy, { rebalance: argv.rebalance });
    spin.succeed('回測完成');
    console.log(`Annual Return: ${(res.annualReturn * 100).toFixed(2)}%`);
    console.log(`Sharpe Ratio: ${res.sharpe.toFixed(2)}`);
    console.log(`Max Drawdown: ${(res.maxDrawdown * 100).toFixed(2)}%`);
  } catch (error) {
    await ErrorHandler.logError(error as Error, 'backtest');
    console.error('回測失敗:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
