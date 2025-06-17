import { DatabaseManager } from '../utils/databaseManager.js';
import { StockScore } from '../types/index.js';
import { ErrorHandler } from '../utils/errorHandler.js';

export interface ChartData {
  labels: string[];
  data: number[];
  title: string;
  type: 'bar' | 'line' | 'scatter';
}

export class Visualizer {
  private dbManager: DatabaseManager;

  constructor() {
    this.dbManager = new DatabaseManager();
  }

  async initialize(): Promise<void> {
    await this.dbManager.initialize();
  }

  async generateTopStocksChart(limit: number = 20): Promise<ChartData> {
    try {
      const db = this.dbManager.getDatabase();
      const scores = db.prepare(`
        SELECT stock_no, total_score
        FROM stock_scores
        ORDER BY total_score DESC
        LIMIT ?
      `).all(limit) as { stock_no: string; total_score: number }[];

      return {
        labels: scores.map(s => s.stock_no),
        data: scores.map(s => s.total_score),
        title: `前 ${limit} 名高潛力股票`,
        type: 'bar'
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'Visualizer.generateTopStocksChart');
      throw error;
    }
  }

  async generateScoreDistributionChart(): Promise<ChartData> {
    try {
      const db = this.dbManager.getDatabase();
      const scores = db.prepare(`
        SELECT total_score
        FROM stock_scores
        ORDER BY total_score
      `).all() as { total_score: number }[];

      // 建立分布區間
      const buckets = new Array(10).fill(0);
      const bucketLabels = [];

      for (let i = 0; i < 10; i++) {
        const min = i * 10;
        const max = (i + 1) * 10;
        bucketLabels.push(`${min}-${max}`);
      }

      scores.forEach(score => {
        const bucketIndex = Math.min(Math.floor(score.total_score / 10), 9);
        buckets[bucketIndex]++;
      });

      return {
        labels: bucketLabels,
        data: buckets,
        title: '總分分布圖',
        type: 'bar'
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'Visualizer.generateScoreDistributionChart');
      throw error;
    }
  }

  async generateFactorComparisonChart(stockNos: string[]): Promise<ChartData[]> {
    try {
      const db = this.dbManager.getDatabase();
      const placeholder = stockNos.map(() => '?').join(',');
      const scores = db.prepare(`
        SELECT stock_no, valuation_score, growth_score, quality_score,
               fund_flow_score, momentum_score
        FROM stock_scores
        WHERE stock_no IN (${placeholder})
      `).all(...stockNos) as StockScore[];

      const factors = [
        { key: 'valuation_score', name: '估值' },
        { key: 'growth_score', name: '成長' },
        { key: 'quality_score', name: '品質' },
        { key: 'fund_flow_score', name: '資金流' },
        { key: 'momentum_score', name: '動能' }
      ];

      return factors.map(factor => ({
        labels: scores.map(s => s.stockNo),
        data: scores.map(s => (s as any)[factor.key] || 0),
        title: `${factor.name}因子比較`,
        type: 'bar' as const
      }));
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'Visualizer.generateFactorComparisonChart');
      throw error;
    }
  }

  async generateTimeSeriesChart(stockNo: string, factor: string): Promise<ChartData> {
    try {
      const db = this.dbManager.getDatabase();
      let query = '';
      let title = '';

      switch (factor) {
        case 'valuation':
          query = `
            SELECT date, per, pbr
            FROM valuation
            WHERE stock_no = ?
            ORDER BY date DESC
            LIMIT 30
          `;
          title = `${stockNo} 估值趨勢`;
          break;
        case 'growth':
          query = `
            SELECT month as date, yoy
            FROM growth
            WHERE stock_no = ?
            ORDER BY month DESC
            LIMIT 12
          `;
          title = `${stockNo} 成長趨勢`;
          break;
        default:
          throw new Error(`不支援的因子: ${factor}`);
      }

      const data = db.prepare(query).all(stockNo) as any[];

      if (data.length === 0) {
        return {
          labels: [],
          data: [],
          title: `${title} (無資料)`,
          type: 'line'
        };
      }

      return {
        labels: data.map(d => d.date).reverse(),
        data: data.map(d => d.per || d.yoy || 0).reverse(),
        title,
        type: 'line'
      };
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'Visualizer.generateTimeSeriesChart');
      throw error;
    }
  }

  // 產生簡單的 ASCII 圖表
  generateASCIIChart(chartData: ChartData): string {
    const { labels, data, title } = chartData;

    if (data.length === 0) {
      return `${title}\n(無資料)`;
    }

    const maxValue = Math.max(...data);
    const maxBarLength = 50;

    let output = `\n${title}\n`;
    output += '='.repeat(title.length) + '\n\n';

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i] || '';
      const value = data[i] || 0;
      const barLength = Math.round((value / maxValue) * maxBarLength);
      const bar = '█'.repeat(barLength) + '░'.repeat(maxBarLength - barLength);

      output += `${label.padEnd(8)} │${bar}│ ${value.toFixed(1)}\n`;
    }

    return output;
  }

  // 產生資料摘要
  async generateSummaryReport(): Promise<string> {
    try {
      const db = this.dbManager.getDatabase();

      // 統計資料
      const totalStocks = db.prepare('SELECT COUNT(*) as count FROM stock_scores').get() as { count: number };
      const avgScore = db.prepare('SELECT AVG(total_score) as avg FROM stock_scores').get() as { avg: number };
      const topStock = db.prepare(`
        SELECT stock_no, total_score
        FROM stock_scores
        ORDER BY total_score DESC
        LIMIT 1
      `).get() as { stock_no: string; total_score: number };

      // 各因子平均分數
      const factorAvgs = db.prepare(`
        SELECT
          AVG(valuation_score) as valuation_avg,
          AVG(growth_score) as growth_avg,
          AVG(quality_score) as quality_avg,
          AVG(fund_flow_score) as fund_flow_avg,
          AVG(momentum_score) as momentum_avg
        FROM stock_scores
      `).get() as any;

      let report = '\n📊 股票篩選系統摘要報告\n';
      report += '================================\n\n';
      report += `📈 總股票數: ${totalStocks.count}\n`;
      report += `🎯 平均總分: ${avgScore.avg?.toFixed(1) || 'N/A'}\n`;
      report += `🏆 最高分股票: ${topStock?.stock_no || 'N/A'} (${topStock?.total_score?.toFixed(1) || 'N/A'}分)\n\n`;

      report += '📊 各因子平均分數:\n';
      report += `  估值: ${factorAvgs.valuation_avg?.toFixed(1) || 'N/A'}\n`;
      report += `  成長: ${factorAvgs.growth_avg?.toFixed(1) || 'N/A'}\n`;
      report += `  品質: ${factorAvgs.quality_avg?.toFixed(1) || 'N/A'}\n`;
      report += `  資金流: ${factorAvgs.fund_flow_avg?.toFixed(1) || 'N/A'}\n`;
      report += `  動能: ${factorAvgs.momentum_avg?.toFixed(1) || 'N/A'}\n`;

      return report;
    } catch (error) {
      await ErrorHandler.logError(error as Error, 'Visualizer.generateSummaryReport');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }
}
