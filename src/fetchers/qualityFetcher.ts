import { FinMindClient, BalanceSheetData, FinancialStatementsData } from '../utils/finmindClient.js';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export interface QualityMetrics {
  stock_id: string;
  date: string;
  roe?: number;          // 股東權益報酬率
  roa?: number;          // 資產報酬率
  gross_margin?: number; // 毛利率
  operating_margin?: number; // 營業利益率
  net_margin?: number;   // 淨利率
  debt_ratio?: number;   // 負債比率
  current_ratio?: number; // 流動比率
  eps?: number;          // 每股盈餘
}

/**
 * 品質指標資料擷取器
 * 使用 FinMind API 獲取財務報表並計算品質指標
 */
export class QualityFetcher {
  private client: FinMindClient;
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(finmindToken?: string) {
    this.client = new FinMindClient(finmindToken);
    this.dbPath = path.join(process.cwd(), 'data', 'quality.db');
  }

  async initialize(): Promise<void> {
    this.getDb();
  }

  private getDb(): Database.Database {
    if (!this.db) {
      // 確保資料夾存在
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      this.initializeDatabase();
    }
    return this.db;
  }

  private initializeDatabase(): void {
    const db = this.getDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS quality_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        stock_id TEXT NOT NULL,
        date TEXT NOT NULL,
        roe REAL,
        roa REAL,
        gross_margin REAL,
        operating_margin REAL,
        net_margin REAL,
        debt_ratio REAL,
        current_ratio REAL,
        eps REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(stock_id, date)
      )
    `);

    console.log('品質指標資料庫初始化完成');
  }

  /**
   * 獲取並計算品質指標
   */
  async fetchQualityMetrics(
    stockId: string,
    startDate: string,
    endDate?: string
  ): Promise<QualityMetrics[]> {
    try {
      console.log(`📊 抓取品質指標: ${stockId} (${startDate} ~ ${endDate || '今日'})`);

      // 並行獲取財務報表和資產負債表
      const [financialData, balanceSheetData] = await Promise.all([
        this.client.getFinancialStatements(stockId, startDate, endDate),
        this.client.getBalanceSheet(stockId, startDate, endDate),
      ]);

      // 計算品質指標
      const qualityMetrics = this.calculateQualityMetrics(
        financialData,
        balanceSheetData,
        stockId
      );

      // 儲存到資料庫
      this.saveQualityMetrics(qualityMetrics);

      console.log(`✅ 成功計算 ${qualityMetrics.length} 期品質指標`);
      return qualityMetrics;

    } catch (error) {
      console.error(`❌ 抓取品質指標失敗 (${stockId}):`, error);
      return [];
    }
  }

  /**
   * 計算各項品質指標
   */
  private calculateQualityMetrics(
    financialData: FinancialStatementsData[],
    balanceSheetData: BalanceSheetData[],
    stockId: string
  ): QualityMetrics[] {
    // 按日期分組
    const financialByDate = this.groupByDate(financialData);
    const balanceSheetByDate = this.groupByDate(balanceSheetData);

    // 合併所有日期
    const allDates = new Set([
      ...Object.keys(financialByDate),
      ...Object.keys(balanceSheetByDate)
    ]);

    const results: QualityMetrics[] = [];

    for (const date of allDates) {
      const financial = financialByDate[date] || [];
      const balanceSheet = balanceSheetByDate[date] || [];

      const metrics = this.calculateSinglePeriodMetrics(
        financial,
        balanceSheet,
        stockId,
        date
      );

      if (metrics) {
        results.push(metrics);
      }
    }

    return results.sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * 計算單一期間的品質指標
   */
  private calculateSinglePeriodMetrics(
    financial: FinancialStatementsData[],
    balanceSheet: BalanceSheetData[],
    stockId: string,
    date: string
  ): QualityMetrics | null {
    const metrics: QualityMetrics = {
      stock_id: stockId,
      date: date
    };

    // 從損益表取得項目
    const revenue = this.findValue(financial, ['營業收入', '營收', '總收入']);
    const grossProfit = this.findValue(financial, ['毛利', '毛利益']);
    const operatingIncome = this.findValue(financial, ['營業利益', '營業收益']);
    const netIncome = this.findValue(financial, ['本期淨利', '淨利', '稅後淨利']);
    const eps = this.findValue(financial, ['每股盈餘', '基本每股盈餘', 'EPS']);

    // 從資產負債表取得項目
    const totalAssets = this.findValue(balanceSheet, ['資產總額', '總資產']);
    const totalLiabilities = this.findValue(balanceSheet, ['負債總額', '總負債']);
    const totalEquity = this.findValue(balanceSheet, ['權益總額', '總權益', '股東權益']);
    const currentAssets = this.findValue(balanceSheet, ['流動資產']);
    const currentLiabilities = this.findValue(balanceSheet, ['流動負債']);

    // 計算各項比率
    if (revenue && revenue > 0) {
      if (grossProfit) {
        metrics.gross_margin = (grossProfit / revenue) * 100;
      }
      if (operatingIncome) {
        metrics.operating_margin = (operatingIncome / revenue) * 100;
      }
      if (netIncome) {
        metrics.net_margin = (netIncome / revenue) * 100;
      }
    }

    if (totalAssets && totalAssets > 0) {
      if (netIncome) {
        metrics.roa = (netIncome / totalAssets) * 100;
      }
      if (totalLiabilities) {
        metrics.debt_ratio = (totalLiabilities / totalAssets) * 100;
      }
    }

    if (totalEquity && totalEquity > 0 && netIncome) {
      metrics.roe = (netIncome / totalEquity) * 100;
    }

    if (currentAssets && currentLiabilities && currentLiabilities > 0) {
      metrics.current_ratio = currentAssets / currentLiabilities;
    }

    if (eps) {
      metrics.eps = eps;
    }

    // 至少要有一個指標才回傳
    const hasAnyMetric = Object.keys(metrics).some(key =>
      key !== 'stock_id' && key !== 'date' && metrics[key as keyof QualityMetrics] !== undefined
    );

    return hasAnyMetric ? metrics : null;
  }

  /**
   * 從財務資料中尋找特定項目的值
   */
  private findValue(
    data: (FinancialStatementsData | BalanceSheetData)[],
    searchTerms: string[]
  ): number | undefined {
    for (const term of searchTerms) {
      const item = data.find(d =>
        d.origin_name.includes(term) ||
        d.origin_name === term
      );
      if (item && item.value !== 0) {
        return item.value;
      }
    }
    return undefined;
  }

  /**
   * 按日期分組資料
   */
  private groupByDate<T extends { date: string }>(
    data: T[]
  ): Record<string, T[]> {
    return data.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = [];
      }
      acc[item.date]!.push(item);
      return acc;
    }, {} as Record<string, T[]>);
  }

  /**
   * 儲存品質指標到資料庫
   */
  private saveQualityMetrics(metrics: QualityMetrics[]): void {
    if (metrics.length === 0) return;

    const db = this.getDb();
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO quality_metrics
       (stock_id, date, roe, roa, gross_margin, operating_margin, net_margin, debt_ratio, current_ratio, eps)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const item of metrics) {
      try {
        stmt.run(
          item.stock_id,
          item.date,
          item.roe,
          item.roa,
          item.gross_margin,
          item.operating_margin,
          item.net_margin,
          item.debt_ratio,
          item.current_ratio,
          item.eps
        );
      } catch (error) {
        console.error(`儲存品質指標失敗:`, error);
      }
    }
  }

  /**
   * 從資料庫讀取品質指標
   */
  getQualityMetrics(stockId: string, limit: number = 20): QualityMetrics[] {
    const db = this.getDb();
    const stmt = db.prepare(
      `SELECT * FROM quality_metrics
       WHERE stock_id = ?
       ORDER BY date DESC
       LIMIT ?`
    );

    return stmt.all(stockId, limit) as QualityMetrics[];
  }

  /**
   * 計算品質分數（綜合評價）
   */
  calculateQualityScore(metrics: QualityMetrics): number {
    let score = 0;
    let factors = 0;

    // ROE 評分 (權重: 25%)
    if (metrics.roe !== undefined) {
      if (metrics.roe >= 15) score += 25;
      else if (metrics.roe >= 10) score += 20;
      else if (metrics.roe >= 5) score += 15;
      else if (metrics.roe >= 0) score += 10;
      factors++;
    }

    // 毛利率評分 (權重: 20%)
    if (metrics.gross_margin !== undefined) {
      if (metrics.gross_margin >= 30) score += 20;
      else if (metrics.gross_margin >= 20) score += 15;
      else if (metrics.gross_margin >= 10) score += 10;
      else if (metrics.gross_margin >= 0) score += 5;
      factors++;
    }

    // 營業利益率評分 (權重: 20%)
    if (metrics.operating_margin !== undefined) {
      if (metrics.operating_margin >= 15) score += 20;
      else if (metrics.operating_margin >= 10) score += 15;
      else if (metrics.operating_margin >= 5) score += 10;
      else if (metrics.operating_margin >= 0) score += 5;
      factors++;
    }

    // 負債比率評分 (權重: 15%, 越低越好)
    if (metrics.debt_ratio !== undefined) {
      if (metrics.debt_ratio <= 30) score += 15;
      else if (metrics.debt_ratio <= 50) score += 12;
      else if (metrics.debt_ratio <= 70) score += 8;
      else score += 3;
      factors++;
    }

    // 流動比率評分 (權重: 10%)
    if (metrics.current_ratio !== undefined) {
      if (metrics.current_ratio >= 2) score += 10;
      else if (metrics.current_ratio >= 1.5) score += 8;
      else if (metrics.current_ratio >= 1) score += 5;
      else score += 2;
      factors++;
    }

    // EPS 成長評分 (權重: 10%)
    if (metrics.eps !== undefined && metrics.eps > 0) {
      score += 10;
      factors++;
    }

    return factors > 0 ? score : 0;
  }

  /**
   * 向後相容性方法 - 使用預設參數呼叫新的方法
   * @deprecated 使用 fetchQualityMetrics 方法替代
   */
  async fetchQualityData(): Promise<QualityMetrics[]> {
    console.log('⚠️  使用已棄用的 fetchQualityData 方法，建議改用 fetchQualityMetrics');

    // 使用台積電作為測試股票，抓取最近一年的資料
    const testStocks = ['2330', '2317', '2454'];
    const startDate = '2023-01-01';
    const endDate = '2023-12-31';

    const allData: QualityMetrics[] = [];

    for (const stockId of testStocks) {
      try {
        const metrics = await this.fetchQualityMetrics(stockId, startDate, endDate);
        allData.push(...metrics);
      } catch (error) {
        console.error(`抓取 ${stockId} 品質資料失敗:`, error);
      }
    }

    return allData;
  }

  /**
   * 關閉資料庫連線
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
