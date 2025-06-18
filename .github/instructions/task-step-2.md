# Task Prompt – Step 2 : Scoring Engine + Rank CLI

> 依 **Base Spec v0.3** 實作下列檔案。
> 使用 File-Fence 格式：
> ```ts filename="path/file.ts"
> // code…
> ```

---

## 1️⃣ 需求

| 模組 | 要求 |
|------|------|
| **1. scoringEngine.ts** | 實作 `calcScore(stockNo, weights?)`；內建 default weights 40/25/15/10/10。 |
| **2. rank CLI** | `src/cli/rank.ts`<br>∙ 參數：`--minScore`, `--limit`, `--offline`<br>∙ 預設列出前 30 檔、顯示 total 與五子分。 |
| **3. explain CLI** | `src/cli/explain.ts`<br>∙ 顯示 raw value、z-score、sub-score、missing 欄位。 |
| **4. fetch-all** | `src/cli/fetch-all.ts`：依 Base Spec §6 流程。 |
| **5. cache utils** | `src/cache.ts`：`readCache(dataset,key)`, `writeCache` (JSON, TTL=24h)。 |
| **6. tests** | `tests/scoring.spec.ts`, `tests/rank.spec.ts`：≥ 10 測試，覆蓋率 ≥ 90 %。 |
| **7. README** | 新增 Scoring 章節、`rank` / `explain` 範例。 |

---

## 2️⃣ 驗收條件

| 編號 | 條件 |
|------|------|
| **T-04** | `npm run rank --limit 5` 輸出 5 列，total 降冪且 >= 0 |
| **T-05** | `npm run rank --offline` 在離線 (stub fetch) 模式正常 |
| **T-06** | `npm run explain 2330` 顯示五子分 + missing = [] |
| **T-07** | `npm run fetch-all` 在 15 min 內完成 |
| **T-08** | GitHub Actions cron job 成功執行 fetch-all |
| **T-09** | `npm test` 全綠，cover ≥ 90 % |
| **T-10** | `pnpm run lint` 無 error (依 .eslintrc) |

---

## 3️⃣ 資料夾結構 (生成後應存在)

```

src/
├ adapters/finmind.ts
├ cache.ts
├ cli/
│  ├ rank.ts
│  ├ explain.ts
│  └ fetch-all.ts
├ services/
│  └ scoringEngine.ts
└ db.ts
tests/
├ scoring.spec.ts
└ rank.spec.ts

```

---

## 4️⃣ 提醒

1. 測試需 stub `fetch` & `readCache` → 不打外網。
2. scoringEngine 取 **「最後一筆」** 指標；z-score 以全市場當日分布計。
3. 表不存在欄位給 `NaN` → 該子分 0、加到 `missing` 陣列。
4. CLI 輸出可用 `console.table()`。
5. TypeScript 全專案嚴格模式 (`"strict": true`)。

---

✔ 完成此 Prompt 後，執行 `pnpm i && pnpm run fetch-all && pnpm run rank` 應可獲得正式排行榜。