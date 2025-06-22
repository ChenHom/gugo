import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

async function setupTestDb(): Promise<string> {
  const tmp = os.tmpdir();
  const dbFile = path.join(tmp, `opt-db-${Date.now()}-${Math.random()}.sqlite`);
  process.env.DB_PATH = dbFile;
  const db = new Database(dbFile);
  db.exec(`
    CREATE TABLE price_daily (stock_no TEXT, date TEXT, close REAL);
    CREATE TABLE stock_scores (stock_no TEXT, date TEXT, total_score REAL, market_value REAL);
  `);
  const insP = db.prepare('INSERT INTO price_daily VALUES (?, ?, ?)');
  const insS = db.prepare('INSERT INTO stock_scores VALUES (?, ?, ?, ?)');
  for (const d of ['2021-01-01', '2021-01-02', '2021-01-03']) {
    insP.run('A', d, 1);
    insS.run('A', d, 1, 100);
  }
  db.close();
  return dbFile;
}

describe('CLI optimize command', () => {
  let dbFile: string;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    dbFile = await setupTestDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-opt-'));
  });

  afterEach(async () => {
    const { close } = await import('../src/db.js');
    close();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates png with expected size', async () => {
    const { run } = await import('../src/cli/optimize.js');
    const date = new Date().toISOString().slice(0, 10);
    const png = path.join(tmpDir, `optimize_${date}.png`);
    const shim = path.join(tmpDir, 'python_user_visible');
    fs.writeFileSync(
      shim,
      `#!/usr/bin/env node\nconst fs=require('fs');const m=process.argv.indexOf('-c');const s=process.argv[m+1];const p=s.match(/plt.savefig\\(r'(.*)'/)[1];fs.writeFileSync(p,Buffer.from('89504e470d0a1a0a0000000d4948445200000320000003200802000000','hex'));`
    );
    fs.chmodSync(shim, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${tmpDir}:${oldPath}`;
    const outCsv = path.join(tmpDir, 'res.csv');
    await run(['--start', '2021-01-01', '--rebalance', '1', '--top', '1', '--out', outCsv]);
    process.env.PATH = oldPath;

    expect(fs.existsSync(png)).toBe(true);
    const buf = fs.readFileSync(png);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    expect(width).toBeGreaterThanOrEqual(800);
    expect(height).toBeGreaterThanOrEqual(800);
  });
});
