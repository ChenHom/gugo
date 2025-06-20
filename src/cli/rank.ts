#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { query } from '../db.js';
import { calcScore } from '../services/scoringEngine.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';

export async function main(args: string[] = hideBin(process.argv)): Promise<void> {
  await ErrorHandler.initialize();
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

  const rows = query<{ stock_no: string }>('SELECT DISTINCT stock_no FROM valuation');
  const results: any[] = [];
  const spin = ora('計算分數...').start();

  for (const r of rows) {
    try {
      const score = await calcScore(r.stock_no, {
        weights: weightObj,
        method: argv.method as 'zscore' | 'percentile' | 'rolling',
        window: argv.window,
      });
      if (score.total >= argv.minScore) {
        results.push({ stockNo: r.stock_no, ...score });
      }
    } catch {
      // ignore individual stock errors
    }
  }

  spin.succeed('計算完成');
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

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  try {
    await main(args);
  } catch (error) {
    await ErrorHandler.logError(error as Error, 'rank');
    console.error('排名計算失敗:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
