#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { query } from '../db.js';
import { RankRow } from '../services/portfolioBuilder.js';
import { walkForward } from '../services/walkForward.js';
import { CostModel, DEFAULT_BROKERAGE, DEFAULT_TAX, DEFAULT_SLIPPAGE } from '../models/CostModel.js';
import fs from 'fs';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('start', { type: 'string', demandOption: true })
    .option('end', { type: 'string' })
    .option('rebalance', { type: 'number', default: 21 })
    .option('top', { type: 'number', default: 10 })
    .option('mode', { choices: ['equal', 'cap'] as const, default: 'equal' })
    .option('window', { type: 'number', default: 3 })
    .option('step', { type: 'number', default: 1 })
    .option('cost', { type: 'number', default: DEFAULT_BROKERAGE })
    .option('fee', { type: 'number', default: DEFAULT_TAX })
    .option('slip', { type: 'number', default: DEFAULT_SLIPPAGE })
    .option('out', { type: 'string', default: 'walkforward.csv' })
    .help()
    .parseSync();

  const scoreRows = query<any>('SELECT date, stock_no, total_score, market_value FROM stock_scores ORDER BY date');
  const ranks: RankRow[] = scoreRows.map((r: any) => ({
    date: r.date,
    stock: r.stock_no,
    score: r.total_score,
    marketCap: r.market_value,
  }));

  const priceRows = query<any>('SELECT stock_no, date, close FROM price_daily ORDER BY date');
  const prices: Record<string, { date: string; close: number }[]> = {};
    for (const row of priceRows) {
      if (!prices[row.stock_no]) prices[row.stock_no] = [];
      prices[row.stock_no]!.push({ date: row.date, close: row.close });
    }

  const results = walkForward(ranks, prices, {
    start: argv.start,
    end: argv.end,
    rebalance: argv.rebalance,
    top: argv.top,
    mode: argv.mode as 'equal' | 'cap',
    windowYears: argv.window,
    stepMonths: argv.step,
    costModel: new CostModel(argv.cost, argv.fee, argv.slip),
  });

  const header = 'start,end,cagr,sharpe,mdd\n';
  const lines = results.map(r => `${r.start},${r.end},${r.cagr},${r.sharpe},${r.mdd}`).join('\n');
  const csv = header + lines + '\n';
  fs.writeFileSync(argv.out, csv);
  const rowCount = csv.trim().split('\n').length - 1;
  if (rowCount !== results.length) {
    throw new Error(`expected ${results.length} rows, got ${rowCount}`);
  }
  console.log(`wrote ${results.length} windows to ${argv.out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
