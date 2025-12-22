/**
 * 批處理工具
 * 提供具有錯誤處理和重試機制的批次操作
 */

import ora from 'ora';
import { ErrorHandler } from './errorHandler.js';
import { QuotaExceededError, isQuotaError } from './errors.js';

export interface BatchOptions<T> {
  /** 批次大小 */
  batchSize?: number;
  /** 並行數量 */
  concurrency?: number;
  /** 單項操作最大重試次數 */
  maxRetries?: number;
  /** 重試延遲（毫秒） */
  retryDelay?: number;
  /** 是否在失敗時跳過項目 */
  skipOnError?: boolean;
  /** 是否顯示進度 */
  showProgress?: boolean;
  /** 進度訊息前綴 */
  progressPrefix?: string;
  /** 錯誤回調函數 */
  onError?: (item: T, error: Error, retryCount: number) => void | Promise<void>;
  /** 成功回調函數 */
  onSuccess?: (item: T, result: any) => void | Promise<void>;
}

export interface BatchResult<T, R> {
  /** 成功處理的項目和結果 */
  successful: Array<{ item: T; result: R }>;
  /** 失敗的項目和錯誤 */
  failed: Array<{ item: T; error: Error; retryCount: number }>;
  /** 跳過的項目 */
  skipped: Array<{ item: T; reason: string }>;
  /** 總處理時間 */
  duration: number;
  /** 成功率 */
  successRate: number;
}

export class BatchProcessor<T, R = any> {
  private options: Required<BatchOptions<T>>;
  private spinner: any = null;

  constructor(options: BatchOptions<T> = {}) {
    this.options = {
      batchSize: 10,
      concurrency: 3,
      maxRetries: 2,
      retryDelay: 1000,
      skipOnError: true,
      showProgress: true,
      progressPrefix: '處理中',
      onError: () => {},
      onSuccess: () => {},
      ...options
    };
  }

  /**
   * 處理批次作業
   */
  async process<TResult = R>(
    items: T[],
    processor: (item: T) => Promise<TResult>,
    itemDescription?: (item: T) => string
  ): Promise<BatchResult<T, TResult>> {
    const startTime = Date.now();
    const result: BatchResult<T, TResult> = {
      successful: [],
      failed: [],
      skipped: [],
      duration: 0,
      successRate: 0
    };

    if (items.length === 0) {
      return result;
    }

    if (this.options.showProgress) {
      this.spinner = ora(`${this.options.progressPrefix}: 0/${items.length}`).start();
    }

    // 分批處理
    const batches = this.createBatches(items);
    let processedCount = 0;
    let quotaExceeded = false;

    for (const batch of batches) {
      if (quotaExceeded) {
        // 如果配額已用盡，跳過剩餘項目
        break;
      }

      // 控制並行數量
      const promises = batch.map(item =>
        this.processItemWithRetry(item, processor, itemDescription)
      );

      const batchResults = await Promise.allSettled(promises);

      // 處理批次結果
      for (let i = 0; i < batchResults.length; i++) {
        const item = batch[i];
        const batchResult = batchResults[i];

        if (!item || !batchResult) continue;

        processedCount++;

        if (batchResult.status === 'fulfilled') {
          const { success, result: itemResult, error, retryCount } = batchResult.value;

          if (success && itemResult !== undefined) {
            result.successful.push({ item, result: itemResult });
            try {
              await this.options.onSuccess(item, itemResult);
            } catch (callbackError) {
              // onSuccess 回調錯誤不影響主流程
            }
          } else if (error) {
            result.failed.push({ item, error, retryCount });
            try {
              await this.options.onError(item, error, retryCount);
              
              // 檢查是否為配額錯誤
              if (error instanceof QuotaExceededError || error.message === 'QUOTA_EXCEEDED') {
                quotaExceeded = true;
                break; // 跳出當前批次
              }
            } catch (callbackError) {
              // 如果 onError 拋出配額錯誤，也要停止
              if (callbackError instanceof QuotaExceededError || (callbackError as Error).message === 'QUOTA_EXCEEDED') {
                quotaExceeded = true;
                break;
              }
            }
          }
        } else {
          // Promise 被拒絕
          const error = batchResult.reason as Error;
          result.failed.push({ item, error, retryCount: 0 });
          try {
            await this.options.onError(item, error, 0);
          } catch (callbackError) {
            // onError 回調錯誤不影響主流程
          }
        }

        // 更新進度
        if (this.options.showProgress && this.spinner) {
          this.spinner.text = `${this.options.progressPrefix}: ${processedCount}/${items.length}`;
        }
      }
    }

    // 完成處理
    result.duration = Date.now() - startTime;
    result.successRate = result.successful.length / items.length;

    if (this.options.showProgress && this.spinner) {
      const successCount = result.successful.length;
      const failedCount = result.failed.length;

      if (quotaExceeded) {
        this.spinner.warn(`⏸️  處理暫停（配額用盡）: 成功 ${successCount}, 失敗 ${failedCount}, 總計 ${items.length}`);
      } else if (failedCount === 0) {
        this.spinner.succeed(`✅ 完成處理 ${successCount}/${items.length} 項目`);
      } else {
        this.spinner.succeed(`✅ 處理完成: 成功 ${successCount}, 失敗 ${failedCount}, 總計 ${items.length}`);
      }
    }

    return result;
  }

  /**
   * 帶重試的項目處理
   */
  private async processItemWithRetry<TResult>(
    item: T,
    processor: (item: T) => Promise<TResult>,
    itemDescription?: (item: T) => string
  ): Promise<{ success: boolean; result?: TResult; error?: Error; retryCount: number }> {
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const result = await processor(item);
        return { success: true, result, retryCount: attempt };
      } catch (error) {
        lastError = error as Error;
        retryCount = attempt;

        // 記錄錯誤（跳過配額錯誤，避免顯示 stack trace）
        if (!isQuotaError(lastError)) {
          const itemDesc = itemDescription ? itemDescription(item) : String(item);
          await ErrorHandler.logError(lastError, `batch-processor:${itemDesc}`);
        }

        // 如果不是最後一次嘗試，等待後重試
        if (attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelay * (attempt + 1)); // 指數退避
        }
      }
    }

    return { success: false, error: lastError!, retryCount };
  }

  /**
   * 創建批次
   */
  private createBatches(items: T[]): T[][] {
    const batches: T[][] = [];
    const { batchSize, concurrency } = this.options;

    // 計算實際批次大小（考慮並行數量）
    const actualBatchSize = Math.max(batchSize, concurrency);

    for (let i = 0; i < items.length; i += actualBatchSize) {
      batches.push(items.slice(i, i + actualBatchSize));
    }

    return batches;
  }

  /**
   * 延遲函數
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 顯示結果摘要
   */
  static showSummary<T, R>(result: BatchResult<T, R>, itemDescription?: (item: T) => string): void {
    const { successful, failed, skipped, duration, successRate } = result;
    const total = successful.length + failed.length + skipped.length;

    console.log('\n📊 批次處理結果摘要:');
    console.log('='.repeat(50));
    console.log(`總計: ${total} 項目`);
    console.log(`✅ 成功: ${successful.length} (${(successRate * 100).toFixed(1)}%)`);
    console.log(`❌ 失敗: ${failed.length}`);
    console.log(`⏭️  跳過: ${skipped.length}`);
    console.log(`⏱️  耗時: ${(duration / 1000).toFixed(1)} 秒`);

    // 顯示失敗項目詳情
    if (failed.length > 0) {
      console.log('\n❌ 失敗項目詳情:');
      failed.forEach(({ item, error, retryCount }) => {
        const itemDesc = itemDescription ? itemDescription(item) : String(item);
        console.log(`  • ${itemDesc}: ${error.message} (重試 ${retryCount} 次)`);
      });
    }

    // 顯示跳過項目詳情
    if (skipped.length > 0) {
      console.log('\n⏭️  跳過項目詳情:');
      skipped.forEach(({ item, reason }) => {
        const itemDesc = itemDescription ? itemDescription(item) : String(item);
        console.log(`  • ${itemDesc}: ${reason}`);
      });
    }
  }
}

/**
 * 便捷函數：處理股票清單
 */
export async function processStocks<R>(
  stockCodes: string[],
  processor: (stockCode: string) => Promise<R>,
  options: BatchOptions<string> = {}
): Promise<BatchResult<string, R>> {
  const batchProcessor = new BatchProcessor({
    progressPrefix: '抓取股票資料',
    concurrency: 5,
    maxRetries: 2,
    skipOnError: true,
    ...options
  });

  return batchProcessor.process(
    stockCodes,
    processor,
    (stockCode) => stockCode
  );
}

/**
 * 便捷函數：處理具有描述的項目清單
 */
export async function processItems<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchOptions<T> & {
    itemDescription?: (item: T) => string;
    progressPrefix?: string;
  } = {}
): Promise<BatchResult<T, R>> {
  const { itemDescription, progressPrefix = '處理項目', ...batchOptions } = options;

  const batchProcessor = new BatchProcessor({
    progressPrefix,
    ...batchOptions
  });

  return batchProcessor.process(items, processor, itemDescription);
}
