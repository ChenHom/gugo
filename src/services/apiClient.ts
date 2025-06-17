import fetch from 'node-fetch';
import { API_BASE_URL, RATE_LIMIT } from '../constants/index.js';
import { ErrorHandler } from '../utils/errorHandler.js';
import { CacheManager } from '../utils/cacheManager.js';

export class ApiClient {
  private cacheManager: CacheManager;
  private lastRequestTime = 0;

  constructor() {
    this.cacheManager = new CacheManager();
  }

  async initialize(): Promise<void> {
    await this.cacheManager.initialize();
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / RATE_LIMIT.REQUESTS_PER_SECOND;

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve =>
        setTimeout(resolve, minInterval - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
  }

  async get<T>(
    endpoint: string,
    params: Record<string, string> = {},
    useCache: boolean = true,
    cacheTtl: number = 24 * 60 * 60 * 1000 // 1 day
  ): Promise<T> {
    const url = new URL(endpoint, API_BASE_URL);

    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const cacheKey = url.toString();

    // Try cache first
    if (useCache) {
      const cached = await this.cacheManager.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Rate limiting
    await this.rateLimit();

    // Make request with retry logic
    const result = await ErrorHandler.withRetry(async () => {
      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    }, RATE_LIMIT.RETRY_ATTEMPTS, RATE_LIMIT.RETRY_DELAY_MS);

    // Cache the result
    if (useCache) {
      await this.cacheManager.set(cacheKey, result, cacheTtl);
    }

    return result;
  }

  async clearCache(): Promise<void> {
    await this.cacheManager.clear();
  }

  async cleanupCache(): Promise<void> {
    await this.cacheManager.cleanup();
  }
}
