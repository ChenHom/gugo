import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Database from 'better-sqlite3';

// Test suite for the standalone calcScore function
describe('calcScore', () => {
  let dbFile: string;

  beforeEach(() => {
    vi.resetModules();
    // Prepare a temporary SQLite database for testing
    const tmp = os.tmpdir();
    dbFile = path.join(tmp, `test-db-${Date.now()}-${Math.random()}.sqlite`);
    process.env.DB_PATH = dbFile;
    const db = new Database(dbFile);
    // Create tables used by calcScore
    db.exec(
      `
      CREATE TABLE valuation (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        per REAL,
        pbr REAL,
        dividend_yield REAL
      );
      CREATE TABLE growth (
        stock_no TEXT NOT NULL,
        month TEXT NOT NULL,
        yoy REAL,
        mom REAL,
        eps_qoq REAL
      );
      CREATE TABLE quality (
        stock_no TEXT NOT NULL,
        year INTEGER NOT NULL,
        roe REAL,
        gross_margin REAL,
        op_margin REAL
      );
      CREATE TABLE fundflow (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        foreign_net REAL,
        inv_trust_net REAL
      );
      CREATE TABLE price_daily (
        stock_no TEXT NOT NULL,
        date TEXT NOT NULL,
        close REAL
      );
      `
    );
    // Insert synthetic data for two stocks: A and B
    const insertVal = db.prepare(
      'INSERT INTO valuation(stock_no, date, per, pbr, dividend_yield) VALUES (?, ?, ?, ?, ?)'
    );
    const insertGr = db.prepare(
      'INSERT INTO growth(stock_no, month, yoy, mom, eps_qoq) VALUES (?, ?, ?, ?, ?)'
    );
    const insertQl = db.prepare(
      'INSERT INTO quality(stock_no, year, roe, gross_margin, op_margin) VALUES (?, ?, ?, ?, ?)'
    );
    const insertCh = db.prepare(
      'INSERT INTO fundflow(stock_no, date, foreign_net, inv_trust_net) VALUES (?, ?, ?, ?)'
    );
    const insertMo = db.prepare(
      'INSERT INTO price_daily(stock_no, date, close) VALUES (?, ?, ?)'
    );
    // Two stocks with values 1 and 2 for all metrics
    for (const [code, per, pbr, dy, yoy, mom, eps, roe, gm, op, fr, it, close] of [
      ['A', 10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      ['B', 20, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
    ]) {
      insertVal.run(code, '2021-01-01', per, pbr, dy);
      insertGr.run(code, '2021-01', yoy, mom, eps);
      insertQl.run(code, 2021, roe, gm, op);
      insertCh.run(code, '2021-01-01', fr, it);
      insertMo.run(code, '2021-01-01', close);
    }
    db.close();
  });

  afterEach(async () => {
    // Close any open DB connection in the module and remove temp file
    const { close } = await import('../src/db.js');
    close();
    if (fs.existsSync(dbFile)) fs.unlinkSync(dbFile);
  });

  it('calculates sub-scores and total correctly with default weights (zscore)', async () => {
    const { calcScore } = await import('../src/services/scoringEngine.js');
    const a = await calcScore('A');
    const b = await calcScore('B');
    // Expected sub-scores for A: valuation≈53.33, others≈40; total≈45.33
    expect(a.valuation).toBeCloseTo(53.3333, 3);
    expect(a.growth).toBeCloseTo(40, 3);
    expect(a.quality).toBeCloseTo(40, 3);
    expect(a.chips).toBeCloseTo(40, 3);
    expect(a.momentum).toBeCloseTo(40, 3);
    expect(a.total).toBeCloseTo(45.3333, 3);
    // Expected sub-scores for B: valuation≈46.67, others≈60; total≈54.67
    expect(b.valuation).toBeCloseTo(46.6666, 3);
    expect(b.growth).toBeCloseTo(60, 3);
    expect(b.quality).toBeCloseTo(60, 3);
    expect(b.chips).toBeCloseTo(60, 3);
    expect(b.momentum).toBeCloseTo(60, 3);
    expect(b.total).toBeCloseTo(54.6666, 3);
    expect(a.missing).toEqual([]);
    expect(b.missing).toEqual([]);
  });

  it('reports missing factors when data is absent', async () => {
    // Prepare a fresh DB with only valuation for stock C
    vi.resetModules();
    process.env.DB_PATH = dbFile;
    const db = new Database(dbFile);
    db.exec('DELETE FROM growth; DELETE FROM quality; DELETE FROM fundflow; DELETE FROM price_daily;');
    db.close();
    const { calcScore } = await import('../src/services/scoringEngine.js');
    const c = await calcScore('A');
    // After deleting other tables, growth/quality/chips/momentum become missing
    expect(c.missing).toEqual(expect.arrayContaining([
      'growth', 'quality', 'chips', 'momentum'
    ]));
  });

  it('applies custom weights correctly', async () => {
    const { calcScore } = await import('../src/services/scoringEngine.js');
    // All weight on valuation only
    const opt = { weights: { valuation: 1, growth: 0, quality: 0, chips: 0, momentum: 0 } };
    const a = await calcScore('A', opt);
    expect(a.total).toBeCloseTo(a.valuation, 6);
  });

  it('ensures each stock has data in all factor tables', async () => {
    const { query, close } = await import('../src/db.js');
    const tables = ['valuation', 'growth', 'quality', 'fundflow', 'price_daily'];
    // Collect distinct stock lists per table
    const sets = tables.map(table => new Set(query(`SELECT DISTINCT stock_no FROM ${table}`)
      .map((r: any) => r.stock_no)));
    // All sets should be equal
    for (let i = 1; i < sets.length; i++) {
      expect(sets[i]).toEqual(sets[0]);
    }
    close();
  });
});