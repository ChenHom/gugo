import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

async function setupTestDb(): Promise<string> {
  const tmp = os.tmpdir();
  const dbFile = path.join(tmp, `wf-cli-db-${Date.now()}-${Math.random()}.sqlite`);
  process.env.DB_PATH = dbFile;
  const db = new Database(dbFile);
  db.exec(`
    CREATE TABLE price_daily (stock_no TEXT, date TEXT, close REAL);
    CREATE TABLE stock_scores (stock_no TEXT, date TEXT, total_score REAL, market_value REAL);
  `);
  const insP = db.prepare('INSERT INTO price_daily VALUES (?, ?, ?)');
  const insS = db.prepare('INSERT INTO stock_scores VALUES (?, ?, ?, ?)');
  for (let i = 0; i < 730; i++) {
    const d = new Date(2020, 0, 1 + i).toISOString().slice(0, 10);
    insP.run('A', d, 1);
    insS.run('A', d, 1, 1);
  }
  db.close();
  return dbFile;
}

describe('CLI walk-forward command', () => {
  let dbFile: string;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    dbFile = await setupTestDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-wf-'));
  });

  afterEach(async () => {
    const { close } = await import('../src/db.js');
    close();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes CSV with correct row count', async () => {
    const { run } = await import('../src/cli/walk-forward.js');
    const outCsv = path.join(tmpDir, 'wf.csv');
    await run([
      '--start',
      '2020-01-01',
      '--end',
      '2021-12-31',
      '--rebalance',
      '30',
      '--top',
      '1',
      '--window',
      '1',
      '--step',
      '6',
      '--out',
      outCsv,
    ]);
    const csv = fs.readFileSync(outCsv, 'utf8').trim();
    const rows = csv.split('\n').length - 1;
    const addMonths = (d: string, m: number): string => {
      const dt = new Date(d);
      dt.setMonth(dt.getMonth() + m);
      return dt.toISOString().slice(0, 10);
    };
    let count = 0;
    let cur = '2020-01-01';
    while (addMonths(cur, 12) <= '2021-12-31') {
      count++;
      cur = addMonths(cur, 6);
    }
    expect(rows).toBe(count);
  });
});

