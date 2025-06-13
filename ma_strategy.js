// ma_strategy.js  ——  MA20/60 + 8% 停損回測（含三大指標說明切換）
//
// 用法：
//   node ma_strategy.js <csv路徑>                       # 只顯示數字
//   node ma_strategy.js <csv路徑> --explain=short      # 數字 + 一行摘要
//   node ma_strategy.js <csv路徑> --explain=full       # 數字 + 詳細說明

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";

/* ---------- CLI 解析 ---------- */
if (argv.length < 3) {
  console.log("用法: node ma_strategy.js <csv> [--explain=none|short|full]");
  exit(1);
}
const csvPath = argv[2];
let explain = "none";
argv.slice(3).forEach(arg => {
  const m = arg.match(/^--explain=(.+)$/);
  if (m) explain = m[1];
});
if (!["none", "short", "full"].includes(explain)) explain = "none";

/* ---------- 工具 ---------- */
const parseCSV = txt => txt.trim().split("\n").slice(1)
  .map(l => { const [d, c] = l.split(","); return { date: d, close: +c }; });
const mean = arr => arr.reduce((a,b)=>a+b,0)/arr.length;
const std  = arr => Math.sqrt(mean(arr.map(x => (x-mean(arr))**2)));

/* ---------- 讀檔與計算 ---------- */
const rows = parseCSV(readFileSync(csvPath, "utf8"));

/* MA20/60 */
const ma20=[], ma60=[];
for (let i=0;i<rows.length;i++){
  const w20=rows.slice(Math.max(0,i-19),i+1).map(r=>r.close);
  const w60=rows.slice(Math.max(0,i-59),i+1).map(r=>r.close);
  ma20.push(w20.length===20?mean(w20):null);
  ma60.push(w60.length===60?mean(w60):null);
}

/* 訊號 + 停損 */
const pos=[];
for (let i=0;i<rows.length;i++){
  let sig=0;
  if (ma20[i]!=null&&ma60[i]!=null) sig = ma20[i]>ma60[i]?1:0;
  pos.push(sig);
}
for (let i=pos.length-1;i>0;i--) pos[i]=pos[i-1]; pos[0]=0;

let entry=null;
for (let i=0;i<rows.length;i++){
  if (pos[i]===1 && entry==null) entry=rows[i].close;
  if (pos[i]===0) entry=null;
  if (entry && rows[i].close<=entry*0.92){ pos[i]=0; entry=null; }
}

/* 報酬與指標 */
const pct=rows.map((r,i)=>i? r.close/rows[i-1].close-1:0);
const strat=pct.map((r,i)=>r*pos[i]);
let eq=1; const curve=[];
strat.forEach(r=>{eq*=(1+r);curve.push(eq);});
const annRet = mean(strat)*252;
const annVol = std(strat)*Math.sqrt(252);
const sharpe = annVol? annRet/annVol : NaN;
const peak=curve.map((v,i)=>Math.max(...curve.slice(0,i+1)));
const mdd=Math.min(...curve.map((v,i)=>v/peak[i]-1));

/* ---------- 說明模板 ---------- */
const pctFmt = v => (v*100).toFixed(2)+"%";

const shortExplain = {
  ar : "將平均日報酬換成年複利",
  sh : "報酬 / 波動，值越高越佳",
  md : "峰值到谷底最大跌幅"
};

const fullExplain = `
## 1. 年化報酬率（Annualized Return）

| 面向 | 說明 |
|------|------|
| **概念** | 將「不等長」或「小於一年」的報酬率，換算成 **每年可期望的複利增長百分比**，便於跨期間／跨資產比較。 |
| **常用公式** | 1. 以平均日報酬率 \\(\\bar r\\) 計算：\`(1+ \\bar r)^{252} - 1\`（252 為台/美股年交易日）<br>2. 用累積資產線首尾值（期間 > 1 年）：\`(終值/初值)^{1/年數} - 1\` |
| **如何解讀** | 例：年化 12% ⇒ 長期平均每年複利 +12%，但實際年度報酬可能上下波動。 |

---

## 2. 夏普值（Sharpe Ratio）

| 面向 | 說明 |
|------|------|
| **概念** | **報酬 / 風險比**。原式：\`(投組報酬 − 無風險利率) ÷ 報酬標準差\`。短期比較常直接用日均報酬除波動。 |
| **計算步驟** | 1. 取每日策略報酬列 \`strategyRet\`<br>2. 均值 \\(avg\\)<br>3. 標準差 \\(σ\\)<br>4. \`Sharpe = (avg/σ) × √252\` |
| **典型區間** | <1：低吸引<br>≈1：可接受<br>1–2：穩健<br>>2：優秀 |
| **侷限** | 假設常態分布，對厚尾策略可能低估風險；未考慮回撤深度。 |

---

## 3. 最大回撤（Maximum Drawdown，MDD）

| 面向 | 說明 |
|------|------|
| **概念** | **資產淨值自峰值跌到谷底的最大百分比損失**，評估最壞情境。 |
| **公式** | 1. 累積資產線：\`Equityₙ = Equityₙ₋₁ × (1+rₙ)\`<br>2. 歷史最高點：\`Peakₙ = max(Equity₀…ₙ)\`<br>3. 回撤：\`DDₙ = Equityₙ / Peakₙ − 1\`<br>4. \`MDD = min(DDₙ)\` |
| **解讀** | MDD = −30%：曾最大跌三成。<br>同年化 12% 策略，MDD −15% vs −35%，前者風險更低。 |
| **互補** | 夏普值看「平時波動」，MDD 看「單次最深傷口」，需合併評估。 |
`;

/* ---------- 輸出 ---------- */
if (explain === "none") {
  console.log(`年化報酬率: ${pctFmt(annRet)}`);
  console.log(`夏普值: ${sharpe.toFixed(2)}`);
  console.log(`最大回撤: ${pctFmt(mdd)}`);
} else if (explain === "short") {
  console.log(`年化報酬率: ${pctFmt(annRet)}  — ${shortExplain.ar}`);
  console.log(`夏普值: ${sharpe.toFixed(2)}        — ${shortExplain.sh}`);
  console.log(`最大回撤: ${pctFmt(mdd)}    — ${shortExplain.md}`);
} else { // full
  console.log(`年化報酬率: ${pctFmt(annRet)}`);
  console.log(`夏普值: ${sharpe.toFixed(2)}`);
  console.log(`最大回撤: ${pctFmt(mdd)}\n`);
  console.log(fullExplain.trim());
}
