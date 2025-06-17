#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ScoringEngine } from '../services/scoringEngine.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { DEFAULT_WEIGHTS } from '../types/index.js';

const argv = yargs(hideBin(process.argv))
  .option('minScore', {
    alias: 'm',
    type: 'number',
    description: '最低總分門檻',
    default: 70,
  })
  .option('limit', {
    alias: 'l',
    type: 'number',
    description: '回傳結果數量上限',
    default: 30,
  })
  .option('export', {
    alias: 'e',
    type: 'string',
    choices: ['markdown', 'json', 'csv'],
    description: '匯出格式',
    default: 'markdown',
  })
  .option('weights', {
    alias: 'w',
    type: 'string',
    description: '自訂權重, 格式: 估值,成長,品質,資金流,動能 (例：40,25,15,10,10)',
  })
  .option('stocks', {
    alias: 's',
    type: 'string',
    description: '逗號分隔的股票代號清單',
  })
  .help()
  .parseSync();

async function main(): Promise<void> {
  try {
    await ErrorHandler.initialize();
    console.log('🔍 開始進行股票排名分析...');

    const scoringEngine = new ScoringEngine();
    await scoringEngine.initialize();

    // Parse custom weights if provided
    let weights = DEFAULT_WEIGHTS;
    if (argv.weights) {
      const weightValues = argv.weights.split(',').map(w => parseFloat(w.trim()));
      if (weightValues.length === 5 && weightValues.every(w => !isNaN(w))) {
        weights = {
          valuation: weightValues[0]! / 100,
          growth: weightValues[1]! / 100,
          quality: weightValues[2]! / 100,
          fundFlow: weightValues[3]! / 100,
          momentum: weightValues[4]! / 100,
        };
        console.log('📊 使用自訂權重:', weights);
      } else {
        console.warn('⚠️  權重格式錯誤，使用預設值');
      }
    }

    // Parse stock codes if provided
    const stockCodes = argv.stocks
      ? argv.stocks.split(',').map((s: string) => s.trim())
      : undefined;

    // Calculate scores
    const scores = await scoringEngine.calculateStockScores(stockCodes, weights);

    // Filter and sort
    const filteredScores = scores
      .filter(score => score.totalScore >= argv.minScore)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, argv.limit);

    if (filteredScores.length === 0) {
      console.log('❌ 沒有股票符合最低評分標準');
      process.exit(0);
    }

    // Export results
    switch (argv.export) {
      case 'markdown':
        exportMarkdown(filteredScores);
        break;
      case 'json':
        exportJson(filteredScores);
        break;
      case 'csv':
        exportCsv(filteredScores);
        break;
    }

    console.log(`✅ 分析完成！找到 ${filteredScores.length} 支符合條件的股票`);
    await scoringEngine.close();

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'rank');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  }
}

function exportMarkdown(scores: any[]): void {
  console.log('\n# 🏆 台灣股票排名榜\n');
  console.log('| 排名 | 代號 | 總分 | 估值 | 成長性 | 品質 | 資金流 | 動能 |');
  console.log('|------|------|------|------|--------|------|--------|------|');

  scores.forEach((score, index) => {
    console.log(
      `| ${index + 1} | ${score.stockNo} | ${score.totalScore.toFixed(1)} | ` +
      `${score.valuationScore.toFixed(1)} | ${score.growthScore.toFixed(1)} | ` +
      `${score.qualityScore.toFixed(1)} | ${score.fundFlowScore.toFixed(1)} | ` +
      `${score.momentumScore.toFixed(1)} |`
    );
  });
}

function exportJson(scores: any[]): void {
  console.log(JSON.stringify(scores, null, 2));
}

function exportCsv(scores: any[]): void {
  console.log('排名,代號,總分,估值,成長性,品質,資金流,動能');
  scores.forEach((score, index) => {
    console.log(
      `${index + 1},${score.stockNo},${score.totalScore.toFixed(1)},` +
      `${score.valuationScore.toFixed(1)},${score.growthScore.toFixed(1)},` +
      `${score.qualityScore.toFixed(1)},${score.fundFlowScore.toFixed(1)},` +
      `${score.momentumScore.toFixed(1)}`
    );
  });
}

main();
