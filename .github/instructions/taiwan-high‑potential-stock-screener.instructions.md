---
applyTo: '**'
---
# 🇹🇼 Taiwan High‑Potential Stock Screener — **Base Specification**

> **Persistent spec** to be imported in every subsequent task prompt. Keep this file unchanged except when the core business logic itself changes.

---

## 0  Quick Summary

Build a TypeScript (>=5) / Node 18 tool that ranks Taiwan‑listed equities by a composite score:

```
TotalScore = 40 % Valuation + 25 % Growth + 15 % Quality + 10 % Fund‑flow + 10 % Momentum
```

Data come mainly from **TWSE OpenAPI** and are stored in **SQLite**. The tool must expose a CLI (`fetch-*`, `rank`, `explain`) and pass the acceptance tests listed below.

---

## 1  Roles

```txt
SYSTEM   : Senior TypeScript quant engineer.
ASSISTANT: Write clean, well‑tested TS code & minimal‑friction CLI UX.
USER     : Supplies stock codes (e.g. 2330, 0050) and optional date range.
```

---

## 2  Factor Weights & Raw Fields

| Factor    | Weight | Raw Fields                               | TWSE / Other Endpoint                                 |
| --------- | -----: | ---------------------------------------- | ----------------------------------------------------- |
| Valuation |   40 % | PER, PBR, Dividend Yield                 | `/v1/exchangeReport/BWIBBU_d`                         |
| Growth    |   25 % | Monthly Revenue (YoY, MoM), EPS, EPS QoQ | `/v1/opendata/t187ap03_L`, `/v1/opendata/t51apim03_A` |
| Quality   |   15 % | ROE, Gross Margin, Operating Margin      | `/v1/opendata/t187ap05_L` *or* MOPS XBRL              |
| Fund‑flow |   10 % | 外資/投信買超、Holding Ratio Δ                  | `fund/TWT38U` CSV (TWSE)                              |
| Momentum  |   10 % | 52‑week RS%, MA20 > MA60 days            | `/v1/exchangeReport/MI_INDEX`                         |

---

## 3  Sample API Calls (TypeScript)

```ts
import fetch from 'node-fetch';

/** 3.1 Valuation (PER / PBR / Yield) for 2025‑06‑14 */
const valuationRows = await fetch(
  'https://api.twse.com.tw/v1/exchangeReport/BWIBBU_d?response=open_data&date=20250614'
).then(r => r.json() as any[]);
const tsmc = valuationRows.find(r => r[0] === '2330');
console.log('TSMC PER =', Number(tsmc[2]));

/** 3.2 Monthly Revenue for May 2025 */
const revRows = await fetch(
  'https://api.twse.com.tw/v1/opendata/t187ap03_L'
).then(r => r.json() as any[]);
const rev2330 = revRows.find(r => r['公司代號'] === '2330' && r['年月'] === '202505');
console.log('Revenue YoY % =', Number(rev2330['去年同月增減(％)']));

/** 3.3 Daily Price (OHLCV) — 2025‑06‑14 */
const kAll = await fetch(
  'https://api.twse.com.tw/v1/exchangeReport/MI_INDEX?response=open_data&date=20250614&type=ALL'
).then(r => r.json() as any[]);
// Filter by 2330 and grab close price
```

> *All fetchers must implement exponential back‑off, local caching (`.cache/`) and idempotent upsert into SQLite.*

---

## 4  Database Schema (SQLite)

```sql
-- fundamentals.db
CREATE TABLE valuation (
  stock_no TEXT,
  date     DATE,
  per      REAL,
  pbr      REAL,
  dividend_yield REAL,
  PRIMARY KEY (stock_no, date)
);
CREATE TABLE growth (
  stock_no TEXT,
  month    DATE,
  revenue  INTEGER,
  yoy      REAL,
  mom      REAL,
  eps      REAL,
  eps_qoq  REAL,
  PRIMARY KEY (stock_no, month)
);
CREATE TABLE quality (
  stock_no TEXT,
  year     INTEGER,
  roe      REAL,
  gross_margin REAL,
  op_margin    REAL,
  PRIMARY KEY (stock_no, year)
);
CREATE TABLE fundflow (
  stock_no TEXT,
  date     DATE,
  foreign_net INTEGER,
  inv_trust_net INTEGER,
  holding_ratio REAL,
  PRIMARY KEY (stock_no, date)
);
CREATE TABLE price_daily (
  stock_no TEXT,
  date     DATE,
  close    REAL,
  volume   INTEGER,
  PRIMARY KEY (stock_no, date)
);
```

---

## 5  Scoring Formulas (pseudo‑code)

```ts
const z = (x,m,s)=> s? (x-m)/s : 0;
valScore   = 50 + 25*(-z(PER)) + 25*(-z(PBR)) + 25*z(DividendYield);
growthScore= 50 + 30*z(RevYoY) + 30*z(RevMoM) + 40*z(EPS_QoQ);
qualityScore = 40*pctl(ROE)+30*pctl(GrossMargin)+30*pctl(OpMargin);
fundScore    = 60*pctl(ForeignBuyStreak)+40*pctl(HoldingRatioDelta);
momScore     = 60*pctl(RS52)+40*pctl(MA20_GT_MA60_Days/252);
TotalScore   = 0.4*valScore + 0.25*growthScore + 0.15*qualityScore + 0.10*fundScore + 0.10*momScore;
```

Scores are clipped to 0–100.

---

## 6  CLI Interfaces

* `npm run fetch-all` — execute every fetcher module.
* `npm run rank --minScore=70 --limit=30 --export=markdown` — output ranked list.
* `npm run explain <stockCode>` — display raw stats & factor breakdown.

---

## 7  Non‑Functional Requirements

* **TypeScript 5 + Node 18**, dependencies limited to `better-sqlite3`, `node-fetch`, `yargs`, `vitest`.
* 90 %+ unit‑test coverage; full data refresh ≤ 15 min on 1 vCPU.
* Pass `eslint --max-warnings=0` and `tsc --noEmit`.

---

## 8  Acceptance Checklist (Run on every PR)

| #    | Test                                         | Expected                                                  |
| ---- | -------------------------------------------- | --------------------------------------------------------- |
| T‑01 | `npm run fetch-valuation` on fresh DB        | ≥ 1800 rows inserted into `valuation`.                    |
| T‑02 | `npm run rank`                               | Markdown table header + ≤ 30 rows, all `TotalScore ≥ 70`. |
| T‑03 | `npm run explain 2330`                       | Shows five factor scores summing to TotalScore.           |
| T‑04 | `npm run rank --weights="40,20,20,10,10"`    | Uses new weights (inspect sample).                        |
| T‑05 | Network offline -> `npm run rank`            | Works using cached DB; logs warning.                      |
| T‑06 | `npm test`                                   | ≥ 90 % coverage; all tests green.                         |
| T‑07 | GitHub Actions daily cron                    | Job finishes < 20 min.                                    |
| T‑08 | Performance                                  | `time npm run fetch-all` < 900 s.                         |
| T‑09 | Data integrity spot‑check 2891 on 2025‑06‑14 | Valuation fields match manual calculation.                |
| T‑10 | Schema migration                             | Auto‑upgrade succeeds with `migrations/`.                 |

---

*End of Base Specification – import this file verbatim into every task prompt.*
