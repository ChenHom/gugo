import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

// Shared setup for CLI tests: temporary SQLite with synthetic data
async function setupTestDb(): Promise<string> {
  const tmp = os.tmpdir();
  const dbFile = path.join(tmp, `cli-test-db-${Date.now()}-${Math.random()}.sqlite`);
  process.env.DB_PATH = dbFile;
  const db = new Database(dbFile);
  // Create minimal tables
  db.exec(
    `
    CREATE TABLE valuation (stock_no TEXT, date TEXT, per REAL, pbr REAL, dividend_yield REAL);
    CREATE TABLE growth (stock_no TEXT, month TEXT, yoy REAL, mom REAL, eps_qoq REAL);
    CREATE TABLE quality (stock_no TEXT, year INTEGER, roe REAL, gross_margin REAL, op_margin REAL);
    CREATE TABLE fundflow (stock_no TEXT, date TEXT, foreign_net REAL, inv_trust_net REAL);
    CREATE TABLE price_daily (stock_no TEXT, date TEXT, close REAL);
    CREATE TABLE stock_scores (stock_no TEXT, date TEXT, total_score REAL, market_value REAL);
    `
  );
  const insV = db.prepare('INSERT INTO valuation VALUES (?, ?, ?, ?, ?)');
  const insG = db.prepare('INSERT INTO growth VALUES (?, ?, ?, ?, ?)');
  const insQ = db.prepare('INSERT INTO quality VALUES (?, ?, ?, ?, ?)');
  const insC = db.prepare('INSERT INTO fundflow VALUES (?, ?, ?, ?)');
  const insM = db.prepare('INSERT INTO price_daily VALUES (?, ?, ?)');
  const insS = db.prepare('INSERT INTO stock_scores VALUES (?, ?, ?, ?)');
  // Insert two stocks A and B
  for (const [code, val] of [['A', 1], ['B', 2]]) {
    insV.run(code, '2021-01-01', val * 10, val, val);
    insG.run(code, '2021-01', val, val, val);
    insQ.run(code, 2021, val, val, val);
    insC.run(code, '2021-01-01', val, val);
    insM.run(code, '2021-01-01', val);
    insS.run(code, '2021-01-01', val, val * 100);
  }
  db.close();
  return dbFile;
}

describe('CLI rank command', () => {
  let dbFile: string;

  beforeEach(async () => {
    vi.resetModules();
    dbFile = await setupTestDb();
  });

  afterEach(async () => {
    const { close } = await import('../src/db.js');
    close();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  it('outputs stocks sorted by total score', async () => {
    const { run } = await import('../src/cli/rank.js');
    const tableMock = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--minScore', '0', '--limit', '10']);
    expect(tableMock).toHaveBeenCalledTimes(1);
    const printed = tableMock.mock.calls[0][0] as Array<Record<string, string>>;
    // Expect B first (higher values), then A
    expect(printed[0].stock).toBe('B');
    expect(printed[1].stock).toBe('A');
    tableMock.mockRestore();
  });

  it('applies custom weights to ranking', async () => {
    const { run } = await import('../src/cli/rank.js');
    const tableMock = vi.spyOn(console, 'table').mockImplementation(() => {});
    // Weight only valuation: A has higher per relative score
    await run(['--minScore', '0', '--limit', '10', '--weights', '1,0,0,0,0']);
    const printed = tableMock.mock.calls[0][0] as Array<Record<string, string>>;
    expect(printed[0].stock).toBe('A');
    tableMock.mockRestore();
  });
});

describe('CLI explain command', () => {
  let dbFile: string;

  beforeEach(async () => {
    vi.resetModules();
    dbFile = await setupTestDb();
  });

  afterEach(async () => {
    const { close } = await import('../src/db.js');
    close();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  it('displays individual metric breakdown and missing list', async () => {
    const { run } = await import('../src/cli/explain.js');
    const tableMock = vi.spyOn(console, 'table').mockImplementation(() => {});
    const logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
    await run(['A']);
    expect(tableMock).toHaveBeenCalledTimes(1);
    // missing should be empty for complete data
    expect(logMock).toHaveBeenCalledWith('missing:', JSON.stringify([]));
    // sub-scores line
    const subLine = logMock.mock.calls.find(call => call[0] === 'sub-scores:');
    expect(subLine).toBeDefined();
    tableMock.mockRestore();
    logMock.mockRestore();
  });
});

describe('CLI backtest command', () => {
  let dbFile: string;
  let tmpDir: string;

  beforeEach(async () => {
    vi.resetModules();
    dbFile = await setupTestDb();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-bt-'));
  });

  afterEach(async () => {
    const { close } = await import('../src/db.js');
    close();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs backtest and writes output file', async () => {
    const { run } = await import('../src/cli/backtest.js');
    const logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
    const origWrite = fs.writeFileSync;
    const writeSpy = vi
      .spyOn(fs, 'writeFileSync')
      .mockImplementation((file, data) => {
        const p = path.join(tmpDir, path.basename(file as string));
        origWrite(p, data as string | NodeJS.ArrayBufferView);
      });
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('exit');
    });
    await run([
      '--strategy',
      'rank',
      '--start',
      '2021-01-01',
      '--rebalance',
      '1',
      '--top',
      '1',
    ]);
    logMock.mockRestore();
    writeSpy.mockRestore();
    exitSpy.mockRestore();
    const file = `backtest_${new Date().toISOString().slice(0, 10)}.json`;
    expect(fs.existsSync(path.join(tmpDir, file))).toBe(true);
    const data = JSON.parse(fs.readFileSync(path.join(tmpDir, file), 'utf8'));
    expect(Array.isArray(data.dates)).toBe(true);
  });
});