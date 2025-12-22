import fs from 'fs/promises';
import path from 'path';

export interface ProgressState {
  taskName: string;
  totalStocks: number;
  processedStocks: string[];
  failedStocks: Array<{ stockCode: string; error: string; timestamp: string }>;
  quotaExceeded: boolean;
  lastUpdated: string;
  startTime: string;
}

export interface TaskProgress {
  [taskName: string]: ProgressState;
}

export class ProgressTracker {
  private progressFile: string;
  private sessionId: string;

  constructor(sessionId: string = 'default', baseDir: string = 'data') {
    this.sessionId = sessionId;
    this.progressFile = path.join(baseDir, `progress_${sessionId}.json`);
  }

  /**
   * 載入進度檔案
   */
  async loadProgress(): Promise<TaskProgress> {
    try {
      const data = await fs.readFile(this.progressFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      // 檔案不存在時回傳空物件
      return {};
    }
  }

  /**
   * 儲存進度
   */
  async saveProgress(progress: TaskProgress): Promise<void> {
    const dir = path.dirname(this.progressFile);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.progressFile,
      JSON.stringify(progress, null, 2),
      'utf-8'
    );
  }

  /**
   * 初始化任務進度
   */
  async initTask(taskName: string, totalStocks: string[]): Promise<ProgressState> {
    const progress = await this.loadProgress();
    
    // 檢查是否有舊的進度
    const existingTask = progress[taskName];
    if (existingTask && !this.isProgressStale(existingTask)) {
      console.log(`📂 發現 ${taskName} 的進度記錄 (${existingTask.processedStocks.length}/${existingTask.totalStocks} 已完成)`);
      return existingTask;
    }

    // 建立新的進度記錄
    const newState: ProgressState = {
      taskName,
      totalStocks: totalStocks.length,
      processedStocks: [],
      failedStocks: [],
      quotaExceeded: false,
      lastUpdated: new Date().toISOString(),
      startTime: new Date().toISOString()
    };

    progress[taskName] = newState;
    await this.saveProgress(progress);
    
    return newState;
  }

  /**
   * 更新任務進度
   */
  async updateTask(
    taskName: string,
    stockCode: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    const progress = await this.loadProgress();
    const task = progress[taskName];
    
    if (!task) {
      throw new Error(`Task ${taskName} not found in progress`);
    }

    // 避免重複記錄
    if (!task.processedStocks.includes(stockCode)) {
      task.processedStocks.push(stockCode);
    }

    if (!success && error) {
      task.failedStocks.push({
        stockCode,
        error,
        timestamp: new Date().toISOString()
      });
    }

    task.lastUpdated = new Date().toISOString();
    await this.saveProgress(progress);
  }

  /**
   * 標記配額已用完
   */
  async markQuotaExceeded(taskName: string): Promise<void> {
    const progress = await this.loadProgress();
    const task = progress[taskName];
    
    if (task) {
      task.quotaExceeded = true;
      task.lastUpdated = new Date().toISOString();
      await this.saveProgress(progress);
      console.log(`⚠️  ${taskName} 已標記為配額用盡，將於下次從 ${task.processedStocks.length}/${task.totalStocks} 繼續`);
    }
  }

  /**
   * 取得尚未處理的股票列表
   */
  async getRemainingStocks(taskName: string, allStocks: string[]): Promise<string[]> {
    const progress = await this.loadProgress();
    const task = progress[taskName];
    
    if (!task || task.quotaExceeded === false) {
      return allStocks;
    }

    // 過濾出尚未處理的股票
    const remaining = allStocks.filter(
      stock => !task.processedStocks.includes(stock)
    );

    if (remaining.length < allStocks.length) {
      console.log(`📋 從上次進度繼續: ${task.processedStocks.length}/${allStocks.length} 已完成，剩餘 ${remaining.length} 支`);
    }

    return remaining;
  }

  /**
   * 清除任務進度
   */
  async clearTask(taskName: string): Promise<void> {
    const progress = await this.loadProgress();
    delete progress[taskName];
    await this.saveProgress(progress);
    console.log(`🗑️  已清除 ${taskName} 的進度記錄`);
  }

  /**
   * 清除所有進度
   */
  async clearAll(): Promise<void> {
    try {
      await fs.unlink(this.progressFile);
      console.log(`🗑️  已清除所有進度記錄`);
    } catch (error) {
      // 檔案不存在時忽略錯誤
    }
  }

  /**
   * 檢查進度是否過期（超過 7 天視為過期）
   */
  private isProgressStale(state: ProgressState): boolean {
    const lastUpdated = new Date(state.lastUpdated);
    const now = new Date();
    const daysDiff = (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff > 7;
  }

  /**
   * 取得任務進度摘要
   */
  async getProgressSummary(): Promise<string[]> {
    const progress = await this.loadProgress();
    const summary: string[] = [];

    for (const [taskName, state] of Object.entries(progress)) {
      const percentage = ((state.processedStocks.length / state.totalStocks) * 100).toFixed(1);
      const status = state.quotaExceeded ? '⏸️  暫停（配額用盡）' : '✅ 完成';
      summary.push(
        `${taskName}: ${state.processedStocks.length}/${state.totalStocks} (${percentage}%) - ${status}`
      );
    }

    return summary;
  }

  /**
   * 檢查是否有任何任務因配額用盡而暫停
   */
  async hasQuotaExceededTasks(): Promise<boolean> {
    const progress = await this.loadProgress();
    return Object.values(progress).some(task => task.quotaExceeded);
  }
}

/**
 * 檢測是否為 FinMind 配額錯誤
 */
export function isQuotaExceededError(error: Error): boolean {
  return (
    error.message.includes('402 Payment Required') ||
    error.message.includes('402') ||
    error.message.includes('quota') ||
    error.message.includes('配額')
  );
}
