# CLI 使用手冊

本文件列出 `npm run` 指令的說明與範例。

## 建置與開發

- `npm run build`：編譯 TypeScript 專案。

```bash
npm run build
```

- `npm run dev`：以 tsx 執行 `src/index.ts`，方便開發。

```bash
npm run dev
```

## 資料抓取

- `npm run fetch-all`：一次抓取所有因子與價格資料。

```bash
npm run fetch-all
```

- `npm run fetch-valuation`：抓取本益比、股價淨值比等估值資料，可使用 `--date`、`--stocks` 等參數。

```bash
npm run fetch-valuation -- --date 2024-01-05 --stocks 2330,2303
```

- `npm run fetch-growth`：抓取營收與 EPS 成長資料，需要 FinMind Token。可透過 `--type` 指定 `revenue`、`eps` 或 `both`。

```bash
npm run fetch-growth -- --type revenue --stocks 2330
```

- `npm run fetch-quality`：抓取 ROE、毛利率等財務品質指標。

```bash
npm run fetch-quality
```

- `npm run fetch-fund-flow`：抓取外資、投信買賣超等資金流資料。

```bash
npm run fetch-fund-flow -- --stocks 2330 --start-date 2024-01-01
```


- `npm run fetch-momentum`：抓取 RSI、移動平均等動能指標，預設會下載三檔範例股票。

```bash
npm run fetch-momentum -- --stocks 2330,2317 --days 60
```

- `npm run fetch-price`：抓取股價與估值歷史資料。

```bash
npm run fetch-price -- --stocks 2330 --days 30 --type price
```

## 分析與視覺化

- `npm run rank`：計算股票綜合分數並依分數排序，可加入 `--limit`、`--minScore` 等參數。

```bash
npm run rank -- --limit 10 --minScore 70
```

- `npm run explain`：顯示單一股票的詳細指標與評分。

```bash
npm run explain 2330
```

- `npm run visualize`：輸出 ASCII 圖表或摘要報告，支援 `--type`、`--stocks` 等參數。

```bash
npm run visualize -- --type distribution
```

- `npm run backtest`：根據指定策略執行回測。`--strategy` 可選 `ma`、`top_n`、`threshold` 或 `rank`，其中 `ma` 需指定 `--stock`，`top_n` 需提供 `--n`，`threshold` 需提供 `--threshold`。`rank` 策略可調整起始與結束日期、持有數量、再平衡週期、權重模式，以及手續費設定。執行後會將結果另存為 `backtest_<date>.json`。

```bash
npm run backtest -- --strategy rank --start 2018-01-01 --end 2020-12-31 \
  --top 10 --rebalance 21 --mode equal --cost 0.001425 --fee 0.003 --slip 0.0015
```

- `npm run walk-forward`：執行滾動視窗的 Walk‑Forward 分析，可搭配 backtest 相同參數，另可設定 `--window` (年)、`--step` (月) 與 `--end`。
```bash
npm run walk-forward -- --start 2018-01-01 --end 2020-12-31 --top 10 --rebalance 21 --window 3 --step 1
```

- `npm run optimize`：批量測試不同的持股數 (`--top`) 與再平衡週期 (`--rebalance`)，並輸出 `optimize_<date>.png` 熱圖以及 CSV 結果。

```bash
npm run optimize -- --start 2018-01-01 --rebalance 21,42 --top 5,10 --out result.csv
```

- `npm run update`：更新資料庫，可指定因子或股票，使用 `--force` 可忽略快取。

```bash
npm run update -- --factors valuation,growth --force
```

- `npm run bootstrap-pnl`：對權益曲線進行 1000 次 bootstrap，估算最大回撤的 95% 信賴區間。

```bash
npm run bootstrap-pnl
```

## 測試與程式碼品質

- `npm run test`：執行所有單元測試。

```bash
npm run test
```

- `npm run test:coverage`：產生測試覆蓋率報告。

```bash
npm run test:coverage
```

- `npm run test:finmind`：編譯並測試 FinMind API 連線。

```bash
npm run test:finmind
```

- `npm run lint`：使用 ESLint 檢查程式碼。

```bash
npm run lint
```

- `npm run lint:fix`：自動修正 ESLint 錯誤。

```bash
npm run lint:fix
```

- `npm run typecheck`：進行 TypeScript 型別檢查。

```bash
npm run typecheck
```
