#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { query } from '../db.js';
import { calcScore } from '../services/scoringEngine.js';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('minScore', { type: 'number', default: 0 })
    .option('limit', { type: 'number', default: 30 })
    .option('offline', { type: 'boolean', default: false })
    .help()
    .parseSync();

  const rows = query<{ stock_no: string }>('SELECT DISTINCT stock_no FROM valuation');
  const results: any[] = [];

  for (const r of rows) {
    try {
      const score = await calcScore(r.stock_no);
      if (score.total >= argv.minScore) {
        results.push({ stockNo: r.stock_no, ...score });
      }
    } catch {
      // ignore individual stock errors
    }
  }

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
