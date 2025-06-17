import fs from 'fs/promises';
import path from 'path';

export interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class SimpleCache {
  private cacheDir: string;

  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir;
  }

  private async ensureCacheDir(): Promise<void> {
    try {
      await fs.access(this.cacheDir);
    } catch {
      await fs.mkdir(this.cacheDir, { recursive: true });
    }
  }

  private getCacheFilePath(key: string): string {
    // 安全的檔名轉換
    const safeKey = key.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureCacheDir();
      const filePath = this.getCacheFilePath(key);
      const data = await fs.readFile(filePath, 'utf-8');
      const cacheItem: CacheItem<T> = JSON.parse(data);

      // 檢查是否過期
      if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
        await this.delete(key);
        return null;
      }

      return cacheItem.data;
    } catch (error) {
      // Cache miss or error
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlMinutes: number = 30): Promise<void> {
    try {
      await this.ensureCacheDir();
      const filePath = this.getCacheFilePath(key);
      const cacheItem: CacheItem<T> = {
        data,
        timestamp: Date.now(),
        ttl: ttlMinutes * 60 * 1000, // Convert to milliseconds
      };

      await fs.writeFile(filePath, JSON.stringify(cacheItem, null, 2));
    } catch (error) {
      console.warn('Failed to write cache:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async clear(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter(file => file.endsWith('.json'))
          .map(file => fs.unlink(path.join(this.cacheDir, file)))
      );
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  /**
   * 清理過期的快取檔案
   */
  async cleanup(): Promise<void> {
    try {
      await this.ensureCacheDir();
      const files = await fs.readdir(this.cacheDir);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.cacheDir, file);
          const data = await fs.readFile(filePath, 'utf-8');
          const cacheItem: CacheItem<any> = JSON.parse(data);

          // 如果過期，刪除檔案
          if (Date.now() - cacheItem.timestamp > cacheItem.ttl) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // 如果無法解析，刪除檔案
          await fs.unlink(path.join(this.cacheDir, file));
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup cache:', error);
    }
  }
}

// 預設快取實例
export const defaultCache = new SimpleCache('./cache/finmind');
