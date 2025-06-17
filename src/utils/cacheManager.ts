import { promises as fs } from 'fs';
import path from 'path';
import { CACHE_CONFIG } from '../constants/index.js';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

export class CacheManager {
  private cacheDir: string;

  constructor(cacheDir: string = CACHE_CONFIG.DIR) {
    this.cacheDir = cacheDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  private getCacheFilePath(key: string): string {
    // Sanitize key for filename
    const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${sanitizedKey}.json`);
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const filePath = this.getCacheFilePath(key);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry: CacheEntry<T> = JSON.parse(content);

      if (Date.now() > entry.expiry) {
        await this.delete(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      // File doesn't exist or other error
      return null;
    }
  }

  async set<T>(key: string, data: T, ttlMs: number = CACHE_CONFIG.EXPIRY.DAILY): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttlMs,
    };

    const filePath = this.getCacheFilePath(key);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.getCacheFilePath(key);
      await fs.unlink(filePath);
    } catch (error) {
      // File doesn't exist or other error
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
      // Directory doesn't exist or other error
    }
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(this.cacheDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const entry: CacheEntry<any> = JSON.parse(content);

          if (now > entry.expiry) {
            await fs.unlink(filePath);
          }
        } catch (error) {
          // Skip invalid cache files
        }
      }
    } catch (error) {
      // Directory doesn't exist or other error
    }
  }
}
