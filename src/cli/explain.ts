#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { ScoringEngine } from '../services/scoringEngine.js';
import { DatabaseManager } from '../utils/databaseManager.js';
import { ErrorHandler } from '../utils/errorHandler.js';

const argv = yargs(hideBin(process.argv))
  .command('$0 <stockCode>', '分析股票詳細資訊')
  .positional('stockCode', {
    type: 'string',
    description: '要分析的股票代號 (例：2330)',
    demandOption: true,
  })
  .help()
  .parseSync();

async function main(): Promise<void> {
  try {
    await ErrorHandler.initialize();
    const stockCode = argv.stockCode as string;

    console.log(`🔍 分析股票 ${stockCode}...\n`);

    const scoringEngine = new ScoringEngine();
    const dbManager = new DatabaseManager();

    await Promise.all([
      scoringEngine.initialize(),
      dbManager.initialize(),
    ]);

    // Get stock score
    const scores = await scoringEngine.calculateStockScores([stockCode]);
    const stockScore = scores[0];

    if (!stockScore) {
      console.log(`❌ 股票 ${stockCode} 無可用資料`);
      process.exit(1);
    }

    // Display overall score
    console.log('🏆 **總體評分**');
    console.log(`總分: ${stockScore.totalScore.toFixed(1)}/100`);
    console.log(`評級: ${getScoreRank(stockScore.totalScore)}\n`);

    // Factor breakdown
    console.log('📊 **因子分析**');
    console.log(`├─ 估值 (40%):         ${stockScore.valuationScore.toFixed(1)}/100`);
    console.log(`├─ 成長性 (25%):       ${stockScore.growthScore.toFixed(1)}/100`);
    console.log(`├─ 品質 (15%):         ${stockScore.qualityScore.toFixed(1)}/100`);
    console.log(`├─ 資金流 (10%):       ${stockScore.fundFlowScore.toFixed(1)}/100`);
    console.log(`└─ 動能 (10%):         ${stockScore.momentumScore.toFixed(1)}/100\n`);

    // Detailed data
    await showDetailedData(dbManager, stockCode);

    // Investment recommendation
    showInvestmentRecommendation(stockScore);

    await Promise.all([
      scoringEngine.close(),
      dbManager.close(),
    ]);

  } catch (error) {
    await ErrorHandler.logError(error as Error, 'explain');
    console.error('❌ 錯誤:', (error as Error).message);
    process.exit(1);
  }
}

async function showDetailedData(dbManager: DatabaseManager, stockCode: string): Promise<void> {
  // Get latest valuation data
  const valuationData = await dbManager.getValuationData(stockCode);
  const latestValuation = valuationData.sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];

  if (latestValuation) {
    console.log('💰 **估值指標** (最新)');
    console.log(`日期: ${latestValuation.date}`);
    console.log(`├─ 本益比 (P/E): ${latestValuation.per || 'N/A'}`);
    console.log(`├─ 股價淨值比 (P/B): ${latestValuation.pbr || 'N/A'}`);
    console.log(`└─ 股息殖利率: ${latestValuation.dividend_yield || 'N/A'}%\n`);
  }

  // Get latest growth data
  const growthData = await dbManager.getGrowthData(stockCode);
  const latestGrowth = growthData.sort((a, b) =>
    new Date(b.month).getTime() - new Date(a.month).getTime()
  )[0];

  if (latestGrowth) {
    console.log('📈 **成長指標** (最新)');
    console.log(`月份: ${latestGrowth.month}`);
    console.log(`├─ 營收: ${formatCurrency(latestGrowth.revenue)}`);
    console.log(`├─ 營收年增率: ${latestGrowth.yoy ? latestGrowth.yoy.toFixed(2) : 'N/A'}%`);
    console.log(`├─ 營收月增率: ${latestGrowth.mom ? latestGrowth.mom.toFixed(2) : 'N/A'}%`);
    console.log(`├─ 每股盈餘 (EPS): ${latestGrowth.eps || 'N/A'}`);
    console.log(`└─ EPS 季增率: ${latestGrowth.eps_qoq ? latestGrowth.eps_qoq.toFixed(2) : 'N/A'}%\n`);
  }
}

function getScoreRank(score: number): string {
  if (score >= 90) return '🥇 優秀';
  if (score >= 80) return '🥈 非常好';
  if (score >= 70) return '🥉 良好';
  if (score >= 60) return '👍 高於平均';
  if (score >= 50) return '👌 平均';
  return '👎 低於平均';
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toString();
}

function showInvestmentRecommendation(score: any): void {
  console.log('💡 **投資建議**');

  if (score.totalScore >= 80) {
    console.log('🟢 **強力買進** - 多項因子表現優秀，基本面強勁');
  } else if (score.totalScore >= 70) {
    console.log('🟡 **買進** - 整體評分良好，基本面穩固');
  } else if (score.totalScore >= 60) {
    console.log('🔵 **持有** - 表現平均，需密切關注');
  } else if (score.totalScore >= 50) {
    console.log('🟠 **弱勢持有** - 低於平均，考慮減碼');
  } else {
    console.log('🔴 **賣出** - 基本面不佳，風險較高');
  }

  // Specific recommendations based on factor scores
  const recommendations: string[] = [];

  if (score.valuationScore < 40) {
    recommendations.push('⚠️  估值風險偏高 - 股價可能被高估');
  }
  if (score.growthScore > 80) {
    recommendations.push('✅ 成長動能強勁 - 具良好擴張潛力');
  }
  if (score.growthScore < 40) {
    recommendations.push('⚠️  成長動能疲弱 - 擴張潛力有限');
  }

  if (recommendations.length > 0) {
    console.log('\n📋 **重點提醒:**');
    recommendations.forEach(rec => console.log(rec));
  }

  console.log('\n⚠️  **免責聲明:** 此分析僅供參考，不應視為投資建議。');
}

main();
