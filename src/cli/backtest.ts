#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { backtestMA } from '../backtest/maStrategy.js';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('stock', { type: 'string', demandOption: true })
    .help()
    .parseSync();

  const res = await backtestMA(argv.stock);
  console.log(`Annual Return: ${(res.annualReturn * 100).toFixed(2)}%`);
  console.log(`Sharpe Ratio: ${res.sharpe.toFixed(2)}`);
  console.log(`Max Drawdown: ${(res.maxDrawdown * 100).toFixed(2)}%`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}
