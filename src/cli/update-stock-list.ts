#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { StockListService } from '../services/stockListService.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import ora from 'ora';

const argv = yargs(hideBin(process.argv))
  .option('force', {
    alias: 'f',
    type: 'boolean',
    description: '強制更新，即使清單是最新的',
    default: false,
  })
  .help()
  .parseSync();

async function main(): Promise<void> {
  try {
    await ErrorHandler.initialize();

    const stockListService = new StockListService();
    await stockListService.initialize();

    const stats = stockListService.getStockListStats();
    const lastUpdated = stats.lastUpdated;

    if (!argv.force && lastUpdated) {
      const hoursSinceUpdate = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        console.log(`📊 股票清單已是最新（最後更新：${lastUpdated}）`);
        console.log(`💡 使用 --force 可強制更新`);
        stockListService.close();
        return;
      }
    }

    const spinner = ora('📡 從 TWSE 更新股票清單...').start();

    try {
      const updatedCount = await stockListService.updateStockList();
      spinner.succeed(`✅ 股票清單更新完成，共 ${updatedCount} 支股票`);

      // 顯示統計資訊
      const newStats = stockListService.getStockListStats();
      console.log('\n📈 股票清單統計：');
      console.log(`  總計：${newStats.total} 支股票`);
      console.log(`  上市：${newStats.byMarket['上市'] || 0} 支`);
      console.log(`  上櫃：${newStats.byMarket['上櫃'] || 0} 支`);
      console.log(`  興櫃：${newStats.byMarket['興櫃'] || 0} 支`);
      console.log(`  最後更新：${newStats.lastUpdated}`);

    } catch (error) {
      spinner.fail('❌ 股票清單更新失敗');
      await ErrorHandler.logError(error as Error, 'update-stock-list');
      console.error('錯誤詳情：', (error as Error).message);
      process.exit(1);
    } finally {
      stockListService.close();
    }

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'update-stock-list');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as run };
