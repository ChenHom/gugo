import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheManager } from '../src/utils/cacheManager.js';
import { promises as fs } from 'fs';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  const testCacheDir = '.test-cache';

  beforeEach(async () => {
    cacheManager = new CacheManager(testCacheDir);
    await cacheManager.initialize();
  });

  afterEach(async () => {
    await cacheManager.clear();
    try {
      await fs.rmdir(testCacheDir);
    } catch (error) {
      // Directory might not exist
    }
  });

  it('should set and get cached data', async () => {
    const testData = { message: 'Hello, World!' };
    const key = 'test-key';

    await cacheManager.set(key, testData, 1000);
    const retrieved = await cacheManager.get<typeof testData>(key);

    expect(retrieved).toEqual(testData);
  });

  it('should return null for expired cache', async () => {
    const testData = { message: 'Hello, World!' };
    const key = 'test-key-expired';

    await cacheManager.set(key, testData, 1); // 1ms TTL

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 10));

    const retrieved = await cacheManager.get<typeof testData>(key);
    expect(retrieved).toBeNull();
  });

  it('should return null for non-existent key', async () => {
    const retrieved = await cacheManager.get('non-existent-key');
    expect(retrieved).toBeNull();
  });

  it('should delete cached data', async () => {
    const testData = { message: 'Hello, World!' };
    const key = 'test-key-delete';

    await cacheManager.set(key, testData);
    await cacheManager.delete(key);

    const retrieved = await cacheManager.get<typeof testData>(key);
    expect(retrieved).toBeNull();
  });
});
