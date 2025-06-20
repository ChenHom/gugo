#!/usr/bin/env node
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';
import { backtestMA } from '../backtest/maStrategy.js';
import ora from 'ora';
import { ErrorHandler } from '../utils/errorHandler.js';

export async function run(args: string[] = hideBin(process.argv)): Promise<void> {
  const argv = yargs(args)
    .option('stock', { type: 'string', demandOption: true })
    .help()
    .parseSync();

  await ErrorHandler.initialize();
  const spinner = ora('執行回測中...').start();

  try {
    const res = await backtestMA(argv.stock);
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
