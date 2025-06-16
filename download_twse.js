// 下載 TWSE 月日資料 → 按日期排序後輸出 CSV
// 用法: node download_twse.js <起始年> <股票代號>

import { mkdirSync } from "node:fs";
import { argv, exit } from "node:process";
import sqlite3 from "sqlite3";

async function fetchDaily(startYear, stockNo) {
  const today   = new Date();
  const endYear = today.getFullYear();
  const endMon  = today.getMonth() + 1;
  const pad2    = (n) => String(n).padStart(2, "0");

  let stockName = null;
  const rows = [];

  for (let y = startYear; y <= endYear; y++) {
    const lastM = y === endYear ? endMon : 12;
    for (let m = 1; m <= lastM; m++) {
      const url =
        `https://www.twse.com.tw/exchangeReport/STOCK_DAY` +
        `?response=json&date=${y}${pad2(m)}01&stockNo=${stockNo}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const js = await res.json();
      // 取得股票名稱（API title 格式: '2024/06/01  台積電 (2330)  各日成交資訊'）
      if (!stockName && js.title) {
        const m = js.title.match(/[\u4e00-\u9fa5A-Za-z0-9\(\)]+\s*\((\d+)\)/);
        if (m) {
          stockName = js.title.replace(/\(.+\).*/, '').replace(/^[^\u4e00-\u9fa5A-Za-z]+/, '').trim();
        }
      }
      js.data?.forEach((a) => {
        // 欄位順序: 日期, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌價差, 成交筆數
        const [roc, mm, dd] = a[0].split("/");
        const yyyy = Number(roc) + 1911;
        const parseNum = v => Number(String(v).replace(/,/g, ''));
        rows.push({
          date: `${yyyy}-${pad2(mm)}-${pad2(dd)}`,
          shares: parseNum(a[1]),         // 成交股數
          amount: parseNum(a[2]),         // 成交金額
          open: parseNum(a[3]),           // 開盤價
          high: parseNum(a[4]),           // 最高價
          low: parseNum(a[5]),            // 最低價
          close: parseNum(a[6]),          // 收盤價
          change: parseNum(a[7]),         // 漲跌價差
          transactions: parseNum(a[8])    // 成交筆數
        });
      });
      await new Promise((r) => setTimeout(r, 120)); // 禮貌延遲
    }
  }
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { rows, stockName };
}

if (argv.length < 4) {
  console.log("用法: node download_twse.js <起始年> <股票代號>");
  exit(1);
}
const [startYear, stockNo] = [Number(argv[2]), argv[3]];

fetchDaily(startYear, stockNo)
  .then(({ rows, stockName }) => {
    mkdirSync("data", { recursive: true });
    // 直接用 import 的 sqlite3
    const dbPath = `data/twse_daily.sqlite`;
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      // 股票代號與名稱對照表
      db.run(`CREATE TABLE IF NOT EXISTS stocks (
        stockNo TEXT PRIMARY KEY, -- 股票代號
        name TEXT                 -- 股票名稱（中文或英文）
      )`);
      db.run(`INSERT OR REPLACE INTO stocks (stockNo, name) VALUES (?, ?)`,
        stockNo, stockName || stockNo);
      // 每日行情表，所有 API 欄位
      db.run(`CREATE TABLE IF NOT EXISTS daily (
        stockNo TEXT,        -- 股票代號
        date TEXT,           -- 交易日期 yyyy-mm-dd
        shares INTEGER,      -- 成交股數
        amount INTEGER,      -- 成交金額
        open REAL,           -- 開盤價
        high REAL,           -- 最高價
        low REAL,            -- 最低價
        close REAL,          -- 收盤價
        change REAL,         -- 漲跌價差
        transactions INTEGER,-- 成交筆數
        PRIMARY KEY(stockNo, date)
      )`);
      const stmt = db.prepare(`INSERT OR REPLACE INTO daily (stockNo, date, shares, amount, open, high, low, close, change, transactions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      rows.forEach(r => stmt.run(
        stockNo, r.date, r.shares, r.amount, r.open, r.high, r.low, r.close, r.change, r.transactions
      ));
      stmt.finalize();
    });
    db.close();
    console.log(`✅ 已儲存：data/twse_daily.sqlite（${rows.length} 筆, 股票代號 ${stockNo}）`);
  })
  .catch(console.error);
