import { describe, it, expect, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { MomentumFetcher, MomentumMetrics } from '../../../src/fetchers/momentumFetcher.js';

function tmpDbPath() {
  return path.join(os.tmpdir(), `momentum-test-${Date.now()}-${Math.random()}.db`);
}

describe('MomentumFetcher', () => {
  afterEach(() => {
    // Ensure no tmp files remain
    fs.readdirSync(os.tmpdir())
      .filter(f => f.startsWith('momentum-test-') && f.endsWith('.db'))
      .forEach(f => {
        try {
          fs.unlinkSync(path.join(os.tmpdir(), f));
        } catch {}
      });
  });

  it('calculates MA20 and MA60 window lengths', () => {
    const fetcher = new MomentumFetcher(undefined, ':memory:');
    const prices = Array.from({ length: 100 }, (_, i) => i + 1);
    const ma20 = (fetcher as any).calculateSMA(prices, 20) as number[];
    const ma60 = (fetcher as any).calculateSMA(prices, 60) as number[];
    expect(ma20.length).toBe(81);
    expect(ma60.length).toBe(41);
  });

  it('inserts records into momentum_metrics table', () => {
    const dbPath = tmpDbPath();
    const fetcher = new MomentumFetcher(undefined, dbPath);
    fetcher.initialize();
    const metrics: MomentumMetrics[] = [
      { stock_no: 'A', date: '2024-01-01', ma20_above_ma60_days: 1 },
      { stock_no: 'B', date: '2024-01-01', ma20_above_ma60_days: 2 },
      { stock_no: 'C', date: '2024-01-01', ma20_above_ma60_days: 3 }
    ];
    (fetcher as any).saveMomentumData(metrics);
    const db = (fetcher as any).getDb();
    const row = db.prepare('SELECT COUNT(*) as cnt FROM momentum_metrics').get();
    expect(row.cnt).toBe(3);
    fetcher.close();
    fs.unlinkSync(dbPath);
  });
});
