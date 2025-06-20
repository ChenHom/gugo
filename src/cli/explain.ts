#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { calcScore } from '../services/scoringEngine.js';
import { query, close } from '../db.js';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

function zScore(value: number, arr: number[]): number | null {
  if (value === undefined || arr.length === 0) return null;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  return (value - mean) / std;
}

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .command('$0 <stockNo>', 'stock code')
    .positional('stockNo', { type: 'string', demandOption: true })
    .help()
    .parseSync();

  const stockNo = argv.stockNo as string;

  await ErrorHandler.initialize();
  const spinner = ora(`計算 ${stockNo} 分數中...`).start();
  let result: Awaited<ReturnType<typeof calcScore>>;
  try {
    result = await calcScore(stockNo);
    spinner.succeed('計算完成');
  } catch (error) {
    spinner.fail('計算失敗');
    await ErrorHandler.logError(error as Error, 'explain');
    console.error('❌ 計算失敗');
    process.exit(1);
    return;
  }

  const rows: { metric: string; value: number | null; z: number | null; score?: number }[] = [];

  const valDate = query<{ date: string }>('SELECT MAX(date) as date FROM valuation')[0]?.date;
  if (valDate) {
    const all = query<any>('SELECT stock_no, per, pbr, dividend_yield FROM valuation WHERE date = ?', [valDate]);
    const target = all.find(r => r.stock_no === stockNo);
    const perArr = all.map(r => r.per).filter((v): v is number => typeof v === 'number');
    const pbrArr = all.map(r => r.pbr).filter((v): v is number => typeof v === 'number');
    const dyArr = all.map(r => r.dividend_yield).filter((v): v is number => typeof v === 'number');
    rows.push({ metric: 'per', value: target?.per ?? null, z: zScore(target?.per, perArr), score: result.valuation });
    rows.push({ metric: 'pbr', value: target?.pbr ?? null, z: zScore(target?.pbr, pbrArr) });
    rows.push({ metric: 'dividend_yield', value: target?.dividend_yield ?? null, z: zScore(target?.dividend_yield, dyArr) });
  }

  console.table(rows);
  console.log('missing:', JSON.stringify(result.missing));
  console.log('sub-scores:', JSON.stringify({
    valuation: result.valuation.toFixed(2),
    growth: result.growth.toFixed(2),
    quality: result.quality.toFixed(2),
    chips: result.chips.toFixed(2),
    momentum: result.momentum.toFixed(2),
    total: result.total.toFixed(2),
  }));

  close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
