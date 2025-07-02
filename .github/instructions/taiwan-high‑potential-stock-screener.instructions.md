---
applyTo: '**'
---
# 🇹🇼 Taiwan High-Potential Stock Screener — **Base Specification v0.3**

> *Persistent spec — every future task prompt must `import` this file unmodified unless the core business logic changes.*

---

## 0  Quick Summary

Build a **TypeScript 5 / Node 22** CLI that ranks Taiwan-listed equities by:

```

TotalScore = 40 % Valuation
\+ 25 % Growth
\+ 15 % Quality
\+ 10 % Fund-flow
\+ 10 % Momentum

````

* Data fetched mainly from **TWSE OpenAPI** / FinMind.
* Stored in **SQLite (sql.js + WASM, file-backed)**.
* Must expose CLI commands (`fetch-*`, `fetch-all`, `rank`, `explain`) and pass the acceptance tests (§8).

---

## 1  Roles

```txt
SYSTEM   : Senior TypeScript quant engineer.
ASSISTANT: Produce clean, well-tested TS code & UX-friendly CLI.
USER     : Requests specific fetch / rank / explain operations.
````

---

## 2  Factor Weights & Raw Fields

| Factor    |  Wt. | Raw Metrics                           | Primary Endpoint(s)                                      |
| --------- | ---: | ------------------------------------- | -------------------------------------------------------- |
| Valuation | 40 % | PER, PBR, Dividend Yield              | TWSE `/v1/exchangeReport/BWIBBU_d`                       |
| Growth    | 25 % | Monthly Revenue YoY & MoM, EPS QoQ    | FinMind `TaiwanStockMonthRevenue`, `FinancialStatements` |
| Quality   | 15 % | ROE, Gross Margin, Operating Margin   | FinMind or MOPS XBRL                                     |
| Fund-flow | 10 % | 外資、投信、自營商 5d 累計張數                     | Goodinfo CSV / TWSE `fund/TWT38U`                        |
| Momentum  | 10 % | 52-week RS%, MA20 > MA60 running days | TWSE `/v1/exchangeReport/MI_INDEX`                       |

---

## 3  Tech Stack

| Layer   | Choice                   | Notes                 |
| ------- | ------------------------ | --------------------- |
| Runtime | **Node 22 (ESM)**        | Use top-level `await` |
| DB      | **sql.js** (WASM SQLite) | No native build pains |
| HTTP    | `node-fetch` (v3 ESM)    | Retries + back-off    |
| CLI     | `yargs`                  | Sub-commands & flags  |
| Test    | **Vitest**               | Coverage ≥ 90 %       |
| Lint    | ESLint + Prettier        | `"strict": true`      |

`.env` variables: `FINMIND_TOKEN`, `TWSE_USER_AGENT`.

---

## 4  Database Schema

```sql
-- fundamentals.sqlite (sql.js)
CREATE TABLE valuation  (stockNo TEXT, date DATE, per REAL, pbr REAL, divYield REAL,
                         PRIMARY KEY(stockNo,date));
CREATE TABLE growth     (stockNo TEXT, month DATE, revenue INTEGER, yoy REAL,
                         mom REAL, eps REAL, eps_qoq REAL, PRIMARY KEY(stockNo,month));
CREATE TABLE quality    (stockNo TEXT, year INTEGER, roe REAL, grossMargin REAL,
                         opMargin REAL, PRIMARY KEY(stockNo,year));
CREATE TABLE chips      (stockNo TEXT, date DATE, foreignBuy INTEGER,
                         investBuy INTEGER, dealerBuy INTEGER, PRIMARY KEY(stockNo,date));
CREATE TABLE price_daily(stockNo TEXT, date DATE, close REAL, volume INTEGER,
                         PRIMARY KEY(stockNo,date));
```

All fetchers must **UPSERT** and create indices `(stockNo, date|month|year)`.

---

## 5  Scoring Engine API

```ts
export interface SubScores {
  valuation: number;
  growth   : number;
  quality  : number;
  chips    : number;
  momentum : number;
}
export interface ScoreResult extends SubScores {
  total  : number;       // 0-100
  missing: string[];     // e.g. ['eps']
}
```

*Implementation contract*

```ts
// src/services/scoringEngine.ts
export async function calcScore(
  stockNo: string,
  weights?: Partial<SubScores>
): Promise<ScoreResult>;
```

* Rules:

  * Each sub-score is 0-100 (z-score or percentile).
  * Missing metric → sub-score = 0, metric name pushed to `missing`.
  * `weights` override default **40/25/15/10/10**; must re-normalize to 100 %.

---

## 6  CLI Commands

| Command                                                  | Purpose                                        |
| -------------------------------------------------------- | ---------------------------------------------- |
| `fetch-valuation / -growth / -quality / -chips / -price` | Individual fetchers                            |
| `fetch-all`                                              | Sequentially runs all fetchers (promise chain) |
| `rank [--minScore 70] [--limit 30] [--offline]`          | List sorted by `total`                         |
| `explain <stock>`                                        | Show raw metrics, z-scores & sub-scores        |
| `test`                                                   | Run Vitest                                     |

`--offline` forces cache/DB reads, prohibits network I/O.

---

## 7  Caching & Offline Mode

* `cache/` stores JSON for each dataset + param + date.
* TTL = 24 h; expired cache triggers live fetch.
* In offline mode, stale cache is acceptable; if not present, CLI warns and skips stock.

---

## 8  Tests

[test organization](./test-organization.instructions.md)

---

## 9 功能實作報告

產生的報告應建立在 docs 資料夾並在檔名中包含日期。

```
