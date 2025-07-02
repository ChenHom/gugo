import { FinMindClient } from './finmindClient.js';
import { TWSeApiClient } from './twseApiClient.js';

/**
 * 資料抓取策略管理器
 * 統一管理 TWSE OpenAPI 優先、FinMind 備用的策略
 */
export class DataFetchStrategy {
  private finmindClient: FinMindClient;
  private twseClient: TWSeApiClient;
  private useTwseFallback: boolean = true;

  constructor(finmindToken?: string, useTwseFallback: boolean = true) {
    this.finmindClient = new FinMindClient(finmindToken);
    this.twseClient = new TWSeApiClient();
    this.useTwseFallback = useTwseFallback;
  }

  /**
   * 檢查 FinMind API 是否需要回退
   */
  private shouldFallbackToTwse(error: Error): boolean {
    return this.useTwseFallback && (
      error.message.includes('402 Payment Required') ||
      error.message.includes('Rate limit exceeded')
    );
  }

  /**
   * 統一的資料抓取策略
   * 優先使用 FinMind，在 402 錯誤時自動回退到 TWSE
   */
  async fetchWithFallback<T>(
    primaryFetch: () => Promise<T>,
    fallbackFetch: (() => Promise<T>) | null,
    operationName: string
  ): Promise<T> {
    try {
      // 主要方法：FinMind API
      return await primaryFetch();
    } catch (error) {
      if (error instanceof Error) {
        // 檢查是否為付費方案限制
        if (error.message.includes('402 Payment Required')) {
          console.warn(`⚠️  ${operationName}: FinMind API 需要付費方案，已達免費額度限制`);

          if (fallbackFetch) {
            console.log(`🔄 ${operationName}: 嘗試使用 TWSE OpenAPI 作為備用...`);
            try {
              return await fallbackFetch();
            } catch (fallbackError) {
              console.error(`❌ ${operationName}: TWSE 備用方案也失敗:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
              throw new Error(`所有資料來源都失敗: ${error.message}`);
            }
          } else {
            console.log(`💡 ${operationName}: 建議申請 FinMind 付費方案或等待額度重置`);
            throw error;
          }
        }

        // 其他錯誤直接拋出
        throw error;
      }

      throw error;
    }
  }

  /**
   * 獲取 FinMind 客戶端
   */
  getFinMindClient(): FinMindClient {
    return this.finmindClient;
  }

  /**
   * 獲取 TWSE 客戶端
   */
  getTwseClient(): TWSeApiClient {
    return this.twseClient;
  }

  /**
   * 設定是否啟用 TWSE 備用方案
   */
  setTwseFallback(enabled: boolean): void {
    this.useTwseFallback = enabled;
  }
}
