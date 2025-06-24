# CLI 使用手冊

本文件列出 `npm run` 指令的說明與範例。完整的參數列表可透過 `npm run <command> -- --help` 查看。

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

- `npm run update-stock-list`：更新股票清單，從 TWSE API 取得最新的上市上櫃股票資料。

```bash
# 自動檢查並更新股票清單（如果超過 24 小時）
npm run update-stock-list

# 強制更新股票清單
npm run update-stock-list -- --force
```

- `npm run list-stocks`：查看股票清單，支援條件篩選、分數計算與匯出功能。

```bash
# 查看所有股票基本資訊
npm run list-stocks

# 篩選上市股票，限制顯示 20 支
npm run list-stocks -- --market 上市 --limit 20

# 篩選半導體產業股票
npm run list-stocks -- --industry 半導體

# 計算並顯示股票分數（較耗時）
npm run list-stocks -- --show-scores --limit 10

# 只顯示分數大於 70 的股票
npm run list-stocks -- --show-scores --min-score 70

# 匯出為 CSV 檔案
npm run list-stocks -- --show-scores --export csv --limit 50

# 匯出為 JSON 檔案
npm run list-stocks -- --export json
```

- `npm run fetch-all`：一次抓取所有因子與價格資料。現在會自動檢查並更新股票清單，然後為所有股票抓取資料。

```bash
npm run fetch-all
```

- `npm run fetch-valuation`：抓取本益比、股價淨值比等估值資料，可使用 `--date`、`--stocks` 等參數。

```bash
npm run fetch-valuation -- --date 2024-01-05 --stocks 2330,2303
```

- `npm run fetch-growth`：抓取營收與 EPS 成長資料，需要 FinMind Token。可透過 `--type` 指定 `revenue`、`eps` 或 `both`（預設）。支援 `--stocks` 指定股票代碼清單，`--no-cache` 停用快取。

```bash
# 抓取特定股票的營收資料
npm run fetch-growth -- --type revenue --stocks 2330,2317

# 抓取所有類型的成長資料（營收 + EPS）
npm run fetch-growth -- --type both --stocks 2330

# 不使用快取重新抓取
npm run fetch-growth -- --no-cache --stocks 2330
```

- `npm run fetch-quality`：抓取 ROE、毛利率等財務品質指標。

```bash
npm run fetch-quality -- --stock 2330
```

- `npm run fetch-fund-flow`：抓取外資、投信買賣超等資金流資料。

```bash
npm run fetch-fund-flow -- --stocks 2330,2317 --start-date 2024-01-01
```

- `npm run fetch-momentum`：抓取 RSI、移動平均等動能指標，支援 `--stocks` 指定股票代碼清單，`--days` 指定計算天數。

```bash
npm run fetch-momentum -- --stocks 2330,2317 --days 60
```

- `npm run fetch-price`：抓取股價與估值歷史資料。

```bash
npm run fetch-price -- --stocks 2330 --days 30 --type price
```

## 分析與視覺化

- `npm run rank`：計算股票綜合分數並依分數排序。支援多種評分方法與自訂權重。

**主要參數：**
- `--minScore`：最低分數門檻（預設：0）
- `--limit`：顯示股票數量上限（預設：30）
- `--weights`：自訂權重，格式為 `valuation,growth,quality,fundflow,momentum`
- `--method`：評分方法，可選 `zscore`（預設）、`percentile`、`rolling`
- `--window`：滾動視窗月數，用於 rolling 方法（預設：3）
- `--offline`：離線模式，僅使用快取資料

```bash
# 顯示前 10 名，最低分數 70
npm run rank -- --limit 10 --minScore 70

# 使用自訂權重（估值 50%，成長 30%，品質 20%）
npm run rank -- --weights 50,30,20,0,0

# 使用百分位數評分方法
npm run rank -- --method percentile --limit 20

# 離線模式排名
npm run rank -- --offline --limit 15
```

- `npm run explain`：顯示單一股票的詳細指標與評分分解。

```bash
npm run explain 2330
```

- `npm run visualize`：輸出 ASCII 圖表或摘要報告，支援 `--type`、`--stocks` 等參數。

```bash
npm run visualize -- --type distribution
```

- `npm run backtest`：根據指定策略執行回測。支援多種策略與詳細的成本設定。

**策略選項：**
- `ma`：移動平均策略（需指定 `--stock`）
- `top_n`：前 N 名策略（需指定 `-n`）
- `threshold`：門檻策略（需指定 `--threshold`）
- `rank`：排名策略（預設，可調整各種參數）

**主要參數：**
- `--strategy`：策略類型（預設：ma）
- `--start`：開始日期
- `--end`：結束日期
- `--top`：持有股票數量（預設：10）
- `--rebalance`：再平衡週期（天數，預設：21）
- `--mode`：權重模式，`equal`（等權重）或 `cap`（市值權重，預設：equal）
- `--cost`：交易成本率（預設：0.001425）
- `--fee`：手續費率（預設：0.003）
- `--slip`：滑價率（預設：0.0015）

```bash
# 基本排名策略回測
npm run backtest -- --strategy rank --start 2018-01-01 --end 2020-12-31

# 詳細參數設定
npm run backtest -- --strategy rank --start 2018-01-01 --end 2020-12-31 \
  --top 10 --rebalance 21 --mode equal --cost 0.001425 --fee 0.003 --slip 0.0015

# 門檻策略
npm run backtest -- --strategy threshold --threshold 75 --start 2020-01-01

# 前 N 名策略
npm run backtest -- --strategy top_n -n 5 --start 2020-01-01
```

- `npm run walk-forward`：執行滾動視窗的 Walk‑Forward 分析，用於驗證策略的時間穩定性。

**主要參數：**
- `--start`：分析開始日期
- `--end`：分析結束日期
- `--window`：訓練視窗長度（年數，預設：3）
- `--step`：滾動步長（月數，預設：1）
- 其他參數同 backtest 命令

```bash
# 基本 Walk-Forward 分析
npm run walk-forward -- --start 2018-01-01 --end 2020-12-31

# 自訂視窗與步長
npm run walk-forward -- --start 2018-01-01 --end 2020-12-31 \
  --window 3 --step 1 --top 10 --rebalance 21
```

- `npm run optimize`：批量測試不同的持股數 (`--top`) 與再平衡週期 (`--rebalance`)，輸出最佳化結果。

**主要參數：**
- `--start`：回測開始日期
- `--end`：回測結束日期
- `--top`：測試的持股數量清單（逗號分隔）
- `--rebalance`：測試的再平衡週期清單（逗號分隔）
- `--out`：輸出檔案路徑（預設：optimize_日期.csv）

```bash
# 測試不同參數組合
npm run optimize -- --start 2018-01-01 --rebalance 21,42 --top 5,10

# 指定輸出檔案
npm run optimize -- --start 2018-01-01 --rebalance 21,42 --top 5,10,15 --out result.csv
```

- `npm run update`：更新資料庫，可指定因子或股票，使用 `--force` 可忽略快取。

```bash
npm run update -- --factors valuation,growth --force
```

- `npm run bootstrap-pnl`：對權益曲線進行 1000 次 bootstrap，估算最大回撤的 95% 信賴區間。

```bash
npm run bootstrap-pnl
```

## 快速流程範例

以下範例示範從抓取資料到排名與回測的基本流程：

1. **抓取資料**：使用 `npm run fetch-all`（或個別 `fetch-*` 指令）初始化本地資料庫。

   執行完畢後會在 `data/` 下生成 SQLite 檔案，並於終端顯示各 fetcher 的進度。

   ```bash
   npm run fetch-all
   ```

2. **計算排名**：執行 `npm run rank` 以輸出依綜合分數排序的股票列表。

   此命令會在終端印出排行表，包含股票代號與分數。

   ```bash
   npm run rank -- --limit 20
   ```

3. **執行回測**：最後透過 `npm run backtest` 對排名策略進行歷史回測。

   請指定起始與結束日期、持有數量和再平衡週期，結果將存為 `backtest_<date>.json`，並顯示 CAGR、MDD 等統計。

   ```bash
   npm run backtest -- --strategy rank --start 2018-01-01 --end 2020-12-31 \
     --top 10 --rebalance 21
   ```

完成以上步驟即可獲得排名結果與回測報告，方便快速驗證策略成效。

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
