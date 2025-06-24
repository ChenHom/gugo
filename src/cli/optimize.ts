#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { query } from '../db.js';
import { backtest } from '../services/backtest.js';
import { CostModel } from '../models/CostModel.js';
import { RankRow } from '../services/portfolioBuilder.js';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('start', { type: 'string', demandOption: true })
    .option('end', { type: 'string' })
    .option('grid', { type: 'boolean', default: true })
    .option('tops', { type: 'string', default: '5,10,20' })
    .option('rebalance', { type: 'string', default: '21,42,63' })
    .option('mode', { choices: ['equal', 'cap'] as const, default: 'equal' })
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

  const topVals = argv.tops.split(',').map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  const rebalanceVals = argv.rebalance.split(',').map(v => parseInt(v, 10)).filter(n => !isNaN(n));
  const results: { top: number; rebalance: number; cagr: number; mdd: number }[] = [];
  for (const t of topVals) {
    for (const r of rebalanceVals) {
      const options: any = {
        start: argv.start,
        rebalance: r,
        top: t,
        mode: argv.mode as 'equal' | 'cap',
        costModel: new CostModel(),
      };
      if (argv.end) {
        options.end = argv.end;
      }
      const res = backtest(ranks, prices, options);
      results.push({ top: t, rebalance: r, cagr: res.cagr, mdd: res.mdd });
    }
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const outPath = path.resolve(`optimize_${stamp}.csv`);
  const csv =
    'top,rebalance,cagr,mdd\n' +
    results.map(r => `${r.top},${r.rebalance},${r.cagr},${r.mdd}`).join('\n');
  fs.writeFileSync(outPath, csv);

  const imgFile = path.resolve(`optimize_${stamp}.png`);
  const script = `import csv, matplotlib.pyplot as plt\nxs=[]\nys=[]\nwith open(r'${outPath.replace(/\\/g, "\\\\")}', 'r') as f:\n    r=csv.DictReader(f)\n    for row in r:\n        xs.append(float(row['mdd']))\n        ys.append(float(row['cagr']))\nplt.figure(figsize=(8,8))\nplt.hist2d(xs, ys, bins=30)\nplt.xlabel('MDD')\nplt.ylabel('CAGR')\nplt.savefig(r'${imgFile.replace(/\\/g, "\\\\")}', dpi=100)\n`;
  const py = spawnSync('python_user_visible', ['-u', '-c', script], { stdio: 'inherit' });
  if (py.error) console.error(py.error);
  else console.log(`heatmap saved to ${imgFile}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
