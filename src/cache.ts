import fs from 'fs/promises';
import path from 'path';

const CACHE_DIR = '.cache';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export async function readCache(dataset: string, key: string): Promise<any | null> {
  try {
    const file = path.join(CACHE_DIR, dataset, `${key}.json`);
    const text = await fs.readFile(file, 'utf8');
    const { ts, data } = JSON.parse(text) as { ts: number; data: any };
    if (Date.now() - ts > TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

export async function writeCache(dataset: string, key: string, data: any): Promise<void> {
  const dir = path.join(CACHE_DIR, dataset);
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, `${key}.json`);
  const payload = { ts: Date.now(), data };
  await fs.writeFile(file, JSON.stringify(payload, null, 2));
}
