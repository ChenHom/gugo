#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { query } from '../db.js';
import { calcScore } from '../services/scoringEngine.js';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('minScore', { type: 'number', default: 0 })
    .option('limit', { type: 'number', default: 30 })
    .option('offline', { type: 'boolean', default: false })
    .option('weights', { type: 'string', desc: 'custom weights as a,b,c,d,e' })
    .option('method', { choices: ['zscore', 'percentile', 'rolling'] as const, default: 'zscore' })
    .option('window', { type: 'number', default: 3 })
    .help()
    .parseSync();

  const weightObj: any = {};
  if (argv.weights) {
    const parts = String(argv.weights).split(',');
    const keys = ['valuation', 'growth', 'quality', 'chips', 'momentum'];
    for (let i = 0; i < parts.length && i < keys.length; i++) {
      const num = Number(parts[i]);
      if (!Number.isNaN(num)) weightObj[keys[i] as keyof typeof weightObj] = num;
    }
  }

  await ErrorHandler.initialize();

  const rows = query<{ stock_no: string }>('SELECT DISTINCT stock_no FROM valuation');
  const results: any[] = [];
  const spinner = ora('計算排名中...').start();

  for (const r of rows) {
    try {
      spinner.text = `處理 ${r.stock_no}...`;
      const score = await calcScore(r.stock_no, {
        weights: weightObj,
        method: argv.method as 'zscore' | 'percentile' | 'rolling',
        window: argv.window,
      });
      if (score.total >= argv.minScore) {
        results.push({ stockNo: r.stock_no, ...score });
      }
    } catch (err) {
      await ErrorHandler.logError(err as Error, 'rank');
    }
  }
  spinner.succeed('計算完成');

  results.sort((a, b) => b.total - a.total);
  const top = results.slice(0, argv.limit).map(r => ({
    stock: r.stockNo,
    total: r.total.toFixed(2),
    valuation: r.valuation.toFixed(2),
    growth: r.growth.toFixed(2),
    quality: r.quality.toFixed(2),
    chips: r.chips.toFixed(2),
    momentum: r.momentum.toFixed(2),
  }));

  console.table(top);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
