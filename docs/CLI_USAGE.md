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

- `npm run fetch-momentum`：抓取 RSI、移動平均等動能指標。

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

- `npm run backtest`：執行簡易回測，例如 MA20/60 交叉策略。

```bash
npm run backtest -- --stock 2330
```

- `npm run update`：更新資料庫，可指定因子或股票，使用 `--force` 可忽略快取。

```bash
npm run update -- --factors valuation,growth --force
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
