#!/usr/bin/env node
import { ValuationFetcher } from '../fetchers/valuationFetcher.js';
import { GrowthFetcher } from '../fetchers/growthFetcher.js';
import { QualityFetcher } from '../fetchers/qualityFetcher.js';
import { FundFlowFetcher } from '../fetchers/fundFlowFetcher.js';
import { MomentumFetcher } from '../fetchers/momentumFetcher.js';
import { StockListService } from '../services/stockListService.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { setupCliSignalHandler } from '../utils/signalHandler.js';
import { processStocks, BatchProcessor } from '../utils/batchProcessor.js';
import ora from 'ora';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

interface FetchAllOptions {
  market?: string;
  stocks?: string;
  exclude?: string;
}

export async function run(options: FetchAllOptions = {}): Promise<void> {
  // 設置信號處理
  const signalHandler = setupCliSignalHandler('抓取所有資料');

  await ErrorHandler.initialize();

  // 初始化股票清單服務
  const stockListService = new StockListService();
  await stockListService.initialize();

  // 添加清理函數
  signalHandler.addCleanupFunction(async () => {
    stockListService.close();
  });

  // 檢查並更新股票清單（如果超過 24 小時）
  const stats = stockListService.getStockListStats();
  const lastUpdated = stats.lastUpdated;
  const shouldUpdate = !lastUpdated ||
    (Date.now() - new Date(lastUpdated).getTime()) > 24 * 60 * 60 * 1000;

  if (shouldUpdate) {
    const updateSpin = ora('更新股票清單').start();
    try {
      await stockListService.updateStockList();
      updateSpin.succeed('股票清單更新完成');
    } catch (error) {
      updateSpin.fail('股票清單更新失敗');
      await ErrorHandler.logError(error as Error, 'fetch-all:stock-list-update');
    }
  }

  // 取得所有股票代碼
  let allStocks = stockListService.getAllStocks();
  
  // 根據 market 參數篩選
  if (options.market && options.market !== 'all') {
    const marketMap: Record<string, string> = {
      'tse': '上市',
      'otc': '上櫃',
      'emerging': '興櫃'
    };
    const targetMarket = marketMap[options.market.toLowerCase()];
    if (targetMarket) {
      allStocks = allStocks.filter(stock => stock.market === targetMarket);
      console.log(`📌 篩選市場：${targetMarket}`);
    } else {
      console.log(`⚠️  未知的市場類型：${options.market}，將抓取所有股票`);
    }
  }
  
  let stockCodes: string[];
  
  // 如果指定了特定股票代碼
  if (options.stocks) {
    stockCodes = options.stocks.split(',').map(s => s.trim());
    console.log(`📌 指定股票：${stockCodes.join(', ')}`);
  } else {
    stockCodes = allStocks.map(stock => stock.stockNo);
  }
  
  // 排除特定股票
  if (options.exclude) {
    const excludeList = options.exclude.split(',').map(s => s.trim());
    stockCodes = stockCodes.filter(code => !excludeList.includes(code));
    console.log(`📌 排除股票：${excludeList.join(', ')}`);
  }

  console.log(`📊 將抓取 ${stockCodes.length} 支股票的資料`);

  // 初始化 fetchers
  const valuation = new ValuationFetcher();
  const growth = new GrowthFetcher();
  const quality = new QualityFetcher();
  const fund = new FundFlowFetcher();
  const momentum = new MomentumFetcher();

  // 添加 fetcher 清理函數
  signalHandler.addCleanupFunction(async () => {
    await valuation.close();
    await growth.close();
    await quality.close();
    await fund.close();
    await momentum.close();
  });

  // 分別處理各種類型的資料抓取，使用錯誤跳過機制
  const fetchTasks = [
    {
      name: 'Valuation',
      fetcher: valuation,
      process: async (stockCode: string): Promise<any> => {
        await valuation.initialize();
        return await valuation.fetchValuationData({
          stockNos: [stockCode],
          useCache: true
        });
      }
    },
    {
      name: 'Growth',
      fetcher: growth,
      process: async (stockCode: string): Promise<any> => {
        await growth.initialize();
        await growth.fetchRevenueData({
          stockNos: [stockCode],
          useCache: true
        });
        return await growth.fetchEpsData({
          stockNos: [stockCode],
          useCache: true
        });
      }
    },
    {
      name: 'Quality',
      fetcher: quality,
      process: async (stockCode: string): Promise<any> => {
        await quality.initialize();
        return await quality.fetchQualityMetrics(stockCode, '2020-01-01');
      }
    },
    {
      name: 'Fund Flow',
      fetcher: fund,
      process: async (stockCode: string): Promise<any> => {
        await fund.initialize();
        return await fund.fetchFundFlowData({
          stockNos: [stockCode],
          useCache: true
        });
      }
    },
    {
      name: 'Momentum',
      fetcher: momentum,
      process: async (stockCode: string): Promise<any> => {
        await momentum.initialize();
        return await momentum.fetchMomentumData([stockCode]);
      }
    }
  ];

  // 依序執行各類型的資料抓取
  for (const task of fetchTasks) {
    console.log(`\n🔄 開始抓取 ${task.name} 資料...`);

    const result = await processStocks(stockCodes, task.process, {
      progressPrefix: `抓取 ${task.name}`,
      concurrency: 3,
      maxRetries: 2,
      skipOnError: true,
      showProgress: true,
      onError: (stockCode, error, retryCount) => {
        // 特別處理 402 錯誤
        if (error.message.includes('402 Payment Required')) {
          console.log(`⚠️  ${stockCode} - FinMind API 配額不足，跳過此股票`);
        } else {
          console.log(`❌ ${stockCode} ${task.name} 抓取失敗: ${error.message} (重試 ${retryCount} 次)`);
        }
      }
    });

    // 顯示結果摘要
    if (result.failed.length > 0 || result.successful.length > 0) {
      console.log(`\n📊 ${task.name} 抓取結果:`);
      console.log(`✅ 成功: ${result.successful.length}/${stockCodes.length} 支股票`);
      if (result.failed.length > 0) {
        console.log(`❌ 失敗: ${result.failed.length} 支股票`);

        // 分析失敗原因
        const paymentRequiredCount = result.failed.filter(f =>
          f.error.message.includes('402 Payment Required')
        ).length;

        if (paymentRequiredCount > 0) {
          console.log(`💳 其中 ${paymentRequiredCount} 支因 FinMind API 配額不足而跳過`);
        }
      }
    }
  }

  // 關閉股票清單服務
  stockListService.close();

  console.log('\n🎉 所有資料抓取作業完成！');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = await yargs(hideBin(process.argv))
    .option('market', {
      alias: 'm',
      type: 'string',
      description: '市場類型：tse(上市) | otc(上櫃) | emerging(興櫃) | all(全部)',
      default: 'all',
      choices: ['tse', 'otc', 'emerging', 'all']
    })
    .option('stocks', {
      alias: 's',
      type: 'string',
      description: '指定股票代碼，以逗號分隔（例：2330,2317）'
    })
    .option('exclude', {
      alias: 'e',
      type: 'string',
      description: '排除特定股票代碼，以逗號分隔'
    })
    .example('$0', '抓取所有股票資料')
    .example('$0 --market tse', '只抓取上市股票')
    .example('$0 --market otc', '只抓取上櫃股票')
    .example('$0 --stocks 2330,2317', '只抓取指定股票')
    .example('$0 --market tse --exclude 2330', '抓取上市股票但排除台積電')
    .help()
    .argv;

  await run({
    market: argv.market,
    stocks: argv.stocks,
    exclude: argv.exclude
  });
}
