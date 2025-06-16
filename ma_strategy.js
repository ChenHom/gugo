// ma_strategy.js —— MA20/60 + 8% 停損回測（SQLite 版）
// ------------------------------------------------------
// 用法：
//   node ma_strategy.js <股票代號> [起始年] [--explain=none|short|full]
//
// 依 --explain：
//   none   → 只顯示數字
//   short  → 數字 + 一行摘要
//   full   → 數字 + Markdown 詳解
//
// 最後會印出「策略生存判定: ✅/❌」，並告訴未達標原因。

import { argv, exit } from "node:process";
import sqlite3 from "sqlite3";

/* ---------- CLI 解析 ---------- */
if (argv.length < 3) {
  console.log(
    "用法: node ma_strategy.js <股票代號> [起始年] [--explain=none|short|full]"
  );
  exit(1);
}
const stockNo = argv[2];
let startYear = null;
let explain = "none";

argv.slice(3).forEach((arg) => {
  if (/^\d{4}$/.test(arg)) startYear = Number(arg); // 年份
  const m = arg.match(/^--explain=(.+)$/);
  if (m) explain = m[1];
});
if (!["none", "short", "full"].includes(explain)) explain = "none";

const dbPath = "data/twse_daily.sqlite";

/* ---------- 從 SQLite 讀取資料 ---------- */
function getRows(dbPath, stockNo, startYear) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(err);
    });
    let sql = "SELECT date, close FROM daily WHERE stockNo = ?";
    const params = [stockNo];
    if (startYear) {
      sql += " AND date >= ?";
      params.push(`${startYear}-01-01`);
    }
    sql += " ORDER BY date ASC";
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => ({ date: r.date, close: +r.close })));
      db.close();
    });
  });
}

/* ---------- 工具 ---------- */
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
const std = (arr) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map((x) => (x - m) ** 2)));
};
const pctFmt = (v) => (v * 100).toFixed(2) + "%";

/* ---------- 說明字典 ---------- */
const shortExplain = {
  ar: "— 將平均日報酬換成年複利",
  sh: "— 報酬 / 波動，值越高越佳",
  md: "— 峰值到谷底最大跌幅",
};

const fullExplain = `
## 1. 年化報酬率（Annualized Return）

| 面向 | 說明 |
|------|------|
| **概念** | 將「不等長」或「小於一年」的報酬率，換算成 **每年可期望的複利增長百分比**，便於跨期間／跨資產比較。 |
| **常用公式** | 1. 以平均日報酬率 \\(\\bar r\\) 計算：\`(1+\\bar r)^{252}-1\`（252 ≈ 台/美股交易日）<br>2. 累積資產線首尾值：\`(終值/初值)^{1/年數}-1\` |
| **如何解讀** | 例：年化 12 % ⇒ 長期平均每年複利 +12 %，但實際年度報酬可高可低。 |

---

## 2. 夏普值（Sharpe Ratio）

| 面向 | 說明 |
|------|------|
| **概念** | **報酬 / 風險比**。原式：\`(投組報酬 - 無風險利率) ÷ 報酬標準差\`。短期比較常直接用日均報酬除波動。 |
| **計算步驟** | 1. 每日策略報酬陣列<br>2. 均值 \\(avg\\)<br>3. 標準差 \\(σ\\)<br>4. \`Sharpe = (avg/σ) × √252\` |
| **典型區間** | <1：低吸引 ≈1：可接受 1–2：穩健 >2：優秀 |
| **侷限** | 假設常態分布；未考慮回撤深度。 |

---

## 3. 最大回撤（Maximum Drawdown, MDD）

| 面向 | 說明 |
|------|------|
| **概念** | **資產淨值自峰值跌到谷底的最大百分比損失**，評估最壞情境。 |
| **公式** | 1. 累積資產線 \`Equityₙ = Equityₙ₋₁ × (1+rₙ)\`<br>2. 歷史最高點 \`Peakₙ = max(Equity₀…ₙ)\`<br>3. 回撤 \`DDₙ = Equityₙ / Peakₙ − 1\`<br>4. \`MDD = min(DDₙ)\` |
| **解讀** | MDD = −30 %：曾最大跌三成。 |
| **互補** | 夏普值看「平時波動」，MDD 看「單次最深傷口」。 |
`.trim();

/* ---------- 生存門檻 ---------- */
const surviveRules = {
  annRet: 0.03, // 年化 ≥ 3%
  sharpe: 1.0,  // 夏普 ≥ 1
  mdd: -0.2,    // 最大回撤 ≥ -20%
};

/* ---------- 主程式 ---------- */
function run(rows) {
  /* MA20 / MA60 */
  const ma20 = [],
    ma60 = [];
  for (let i = 0; i < rows.length; i++) {
    const w20 = rows.slice(Math.max(0, i - 19), i + 1).map((r) => r.close);
    const w60 = rows.slice(Math.max(0, i - 59), i + 1).map((r) => r.close);
    ma20.push(w20.length === 20 ? mean(w20) : null);
    ma60.push(w60.length === 60 ? mean(w60) : null);
  }

  /* 訊號 & 停損 */
  const pos = [];
  for (let i = 0; i < rows.length; i++) {
    let sig = 0;
    if (ma20[i] != null && ma60[i] != null) sig = ma20[i] > ma60[i] ? 1 : 0;
    pos.push(sig);
  }
  for (let i = pos.length - 1; i > 0; i--) pos[i] = pos[i - 1];
  pos[0] = 0;

  let entry = null;
  for (let i = 0; i < rows.length; i++) {
    if (pos[i] === 1 && entry === null) entry = rows[i].close;
    if (pos[i] === 0) entry = null;
    if (entry && rows[i].close <= entry * 0.92) {
      pos[i] = 0;
      entry = null;
    }
  }

  /* 報酬 & 指標 */
  const pct = rows.map((r, i) => (i ? r.close / rows[i - 1].close - 1 : 0));
  const strat = pct.map((r, i) => r * pos[i]);

  let eq = 1;
  const curve = [];
  strat.forEach((r) => {
    eq *= 1 + r;
    curve.push(eq);
  });

  const annRet = mean(strat) * 252;
  const annVol = std(strat) * Math.sqrt(252);
  const sharpe = annVol ? annRet / annVol : NaN;
  const peak = curve.map((v, i) => Math.max(...curve.slice(0, i + 1)));
  const mdd = Math.min(...curve.map((v, i) => v / peak[i] - 1));

  /* 生存判定 */
  const isAlive =
    annRet >= surviveRules.annRet &&
    sharpe >= surviveRules.sharpe &&
    mdd >= surviveRules.mdd;

  /* 輸出 */
  if (explain === "none") {
    console.log(`年化報酬率: ${pctFmt(annRet)}`);
    console.log(`夏普值: ${sharpe.toFixed(2)}`);
    console.log(`最大回撤: ${pctFmt(mdd)}`);
  } else if (explain === "short") {
    console.log(`年化報酬率: ${pctFmt(annRet)}  ${shortExplain.ar}`);
    console.log(`夏普值: ${sharpe.toFixed(2)}        ${shortExplain.sh}`);
    console.log(`最大回撤: ${pctFmt(mdd)}   ${shortExplain.md}`);
  } else {
    // full
    console.log(`年化報酬率: ${pctFmt(annRet)}`);
    console.log(`夏普值: ${sharpe.toFixed(2)}`);
    console.log(`最大回撤: ${pctFmt(mdd)}\n`);
    console.log(fullExplain);
  }

  console.log("\n策略生存判定:", isAlive ? "✅ SURVIVE" : "❌ FAIL");
  if (!isAlive) {
    console.log("未達標原因：");
    if (annRet < surviveRules.annRet) console.log("  • 年化報酬率低於 3%");
    if (sharpe < surviveRules.sharpe) console.log("  • 夏普值低於 1.0");
    if (mdd < surviveRules.mdd) console.log("  • 最大回撤超過 -20%");
  }
}

/* ---------- 執行 ---------- */
getRows(dbPath, stockNo, startYear)
  .then(run)
  .catch((e) => {
    console.error("讀取資料失敗：", e.message);
    exit(1);
  });
