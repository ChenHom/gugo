#!/usr/bin/env node

import { DataUpdater, UpdateOptions } from '../services/dataUpdater.js';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface UpdateArgs {
  force?: boolean;
  factors?: string;
  stocks?: string;
  clean?: boolean;
  status?: boolean;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('force', {
      alias: 'f',
      describe: '強制更新，忽略快取',
      type: 'boolean',
      default: false
    })
    .option('factors', {
      describe: '指定要更新的因子 (用逗號分隔)',
      type: 'string'
    })
    .option('stocks', {
      alias: 's',
      describe: '指定要更新的股票代號 (用逗號分隔)',
      type: 'string'
    })
    .option('clean', {
      alias: 'c',
      describe: '清理舊資料 (超過90天)',
      type: 'boolean',
      default: false
    })
    .option('status', {
      describe: '顯示資料更新狀態',
      type: 'boolean',
      default: false
    })
    .help()
    .parseAsync() as UpdateArgs;

  const updater = new DataUpdater();

  try {
    await updater.initialize();

    if (argv.status) {
      await showUpdateStatus(updater);
      return;
    }

    if (argv.clean) {
      await cleanOldData(updater);
    }

    await performUpdate(updater, argv);

  } catch (error) {
    console.error('❌ 更新失敗:', error);
    process.exit(1);
  } finally {
    await updater.close();
  }
}

async function showUpdateStatus(updater: DataUpdater) {
  console.log('📊 資料更新狀態');
  console.log('================');

  const lastUpdateTimes = await updater.getLastUpdateTime();

  for (const [factor, lastUpdate] of Object.entries(lastUpdateTimes)) {
    const status = lastUpdate
      ? `${lastUpdate.toLocaleString('zh-TW')} (${getTimeAgo(lastUpdate)})`
      : '從未更新';

    console.log(`${factor.padEnd(12)}: ${status}`);
  }
}

async function cleanOldData(updater: DataUpdater) {
  console.log('🗑️  清理舊資料...');
  const deletedCount = await updater.cleanOldData(90);
  console.log(`✅ 已清理 ${deletedCount} 筆舊資料`);
}

async function performUpdate(updater: DataUpdater, argv: UpdateArgs) {
  const options: UpdateOptions = {};

  if (argv.force) options.force = argv.force;
  if (argv.factors) options.factors = argv.factors.split(',');
  if (argv.stocks) options.stocks = argv.stocks.split(',');

  console.log('🔄 開始資料更新...');
  if (options.force) {
    console.log('⚡ 強制更新模式 (忽略快取)');
  }
  if (options.factors) {
    console.log(`📊 更新因子: ${options.factors.join(', ')}`);
  }
  if (options.stocks) {
    console.log(`🏢 更新股票: ${options.stocks.join(', ')}`);
  }

  const results = await updater.updateAllData(options);

  console.log('\n📊 更新結果摘要:');
  console.log('================');

  let totalUpdated = 0;
  let successCount = 0;

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const records = result.success ? `${result.recordsUpdated} 筆` : '失敗';

    console.log(`${status} ${result.factor.padEnd(12)}: ${records}`);

    if (result.success) {
      totalUpdated += result.recordsUpdated;
      successCount++;
    } else if (result.error) {
      console.log(`   錯誤: ${result.error}`);
    }
  }

  console.log(`\n🎉 更新完成！`);
  console.log(`   成功: ${successCount}/${results.length} 個因子`);
  console.log(`   總計: ${totalUpdated} 筆記錄`);

  if (successCount > 0) {
    console.log('\n💡 建議下一步:');
    console.log('   • 執行 `npm run rank` 查看最新排名');
    console.log('   • 執行 `npm run visualize` 查看圖表');
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) {
    return `${minutes} 分鐘前`;
  } else if (hours < 24) {
    return `${hours} 小時前`;
  } else {
    return `${days} 天前`;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
