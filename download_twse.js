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

  const rows = []; // {date, close}

  for (let y = startYear; y <= endYear; y++) {
    const lastM = y === endYear ? endMon : 12;
    for (let m = 1; m <= lastM; m++) {
      const url =
        `https://www.twse.com.tw/exchangeReport/STOCK_DAY` +
        `?response=json&date=${y}${pad2(m)}01&stockNo=${stockNo}`;
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const js = await res.json();
      js.data?.forEach((a) => {
        // 轉西元年
        const [roc, mm, dd] = a[0].split("/");
        const yyyy = Number(roc) + 1911;
        const close = Number(a[6].replace(",", ""));
        if (!Number.isNaN(close))
          rows.push({ date: `${yyyy}-${pad2(mm)}-${pad2(dd)}`, close });
      });
      await new Promise((r) => setTimeout(r, 120)); // 禮貌延遲
    }
  }
  rows.sort((a, b) => new Date(a.date) - new Date(b.date));
  return rows;
}

if (argv.length < 4) {
  console.log("用法: node download_twse.js <起始年> <股票代號>");
  exit(1);
}
const [startYear, stockNo] = [Number(argv[2]), argv[3]];

fetchDaily(startYear, stockNo)
  .then((rows) => {
    mkdirSync("data", { recursive: true });
    // 寫入同一個 SQLite 檔案，資料表名稱為 daily，增加 stockNo 欄位
    const dbPath = `data/twse_daily.sqlite`;
    const db = new sqlite3.Database(dbPath);
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS daily (stockNo TEXT, date TEXT, close REAL, PRIMARY KEY(stockNo, date))`);
      const stmt = db.prepare(`INSERT OR REPLACE INTO daily (stockNo, date, close) VALUES (?, ?, ?)`);
      rows.forEach(r => stmt.run(stockNo, r.date, r.close));
      stmt.finalize();
    });
    db.close();
    console.log(`✅ 已儲存：data/twse_daily.sqlite（${rows.length} 筆, 股票代號 ${stockNo}）`);
  })
  .catch(console.error);
