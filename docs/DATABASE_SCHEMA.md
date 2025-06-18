# 台灣高潛力股票篩選系統 - 資料庫結構說明

## 資料庫概覽

本系統使用 SQLite 作為主要資料庫，儲存台股相關的各種財務和市場資料。資料主要來源為 FinMind API，補強 TWSE OpenAPI 不足之處。

## 資料表結構

### 💰 股價相關表

#### `price_daily` - 每日股價資料表
記錄每個交易日的 OHLCV (開高低收量) 資料

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330", "2317" |
| date | DATE | 交易日期 | "2023-06-15" |
| open | REAL | 開盤價 (元) | 446.0 |
| high | REAL | 最高價 (元) | 453.5 |
| low | REAL | 最低價 (元) | 443.0 |
| close | REAL | 收盤價 (元) | 453.0 |
| volume | INTEGER | 成交量 (股) | 15311364 |
| turnover | REAL | 成交金額 (元) | 6871973708 |

#### `valuation` - 股票估值指標表
記錄每日的估值相關指標

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| date | DATE | 資料日期 | "2023-06-15" |
| per | REAL | 本益比 (P/E Ratio) | 13.25 |
| pbr | REAL | 股價淨值比 (P/B Ratio) | 4.29 |
| per_percentile | REAL | 本益比百分位數 | 75.2 |
| pbr_percentile | REAL | 股價淨值比百分位數 | 68.5 |
| dividend_yield | REAL | 股利殖利率 (%) | 2.43 |
| dividend_per_share | REAL | 每股股利金額 (元) | 11.0 |
| market_value | REAL | 市值 (億元) | 117500.0 |

### 📈 基本面相關表

#### `growth` - 成長指標表
記錄公司的營收和獲利成長資料

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| month | DATE | 資料月份 | "2023-05-01" |
| revenue | INTEGER | 月營收 (千元) | 172734567 |
| yoy | REAL | 營收年增率 (%) | 15.6 |
| mom | REAL | 營收月增率 (%) | -3.2 |
| eps | REAL | 每股盈餘 (元) | 7.98 |
| eps_qoq | REAL | 每股盈餘季增率 (%) | 8.5 |

#### `quality` - 品質指標表
記錄公司的獲利品質相關指標

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| year | INTEGER | 資料年度 | 2023 |
| roe | REAL | 股東權益報酬率 (%) | 26.8 |
| gross_margin | REAL | 毛利率 (%) | 56.3 |
| op_margin | REAL | 營業利益率 (%) | 45.5 |

#### `balance_sheet` - 資產負債表
記錄季度財務狀況資料

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| date | DATE | 財報日期 (季度末) | "2023-03-31" |
| total_assets | REAL | 總資產 (千元) | 4123456789 |
| total_liabilities | REAL | 總負債 (千元) | 1595123456 |
| equity | REAL | 股東權益 (千元) | 2528333333 |
| cash_and_equivalents | REAL | 現金及約當現金 (千元) | 1385232810 |
| inventory | REAL | 存貨 (千元) | 234567890 |
| receivables | REAL | 應收帳款 (千元) | 187654321 |
| debt_ratio | REAL | 負債比率 (%) | 38.7 |

#### `cash_flow` - 現金流量表
記錄季度現金流量資料

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| date | DATE | 財報日期 (季度末) | "2023-03-31" |
| operating_cash_flow | REAL | 營業活動現金流量 (千元) | 456789123 |
| investing_cash_flow | REAL | 投資活動現金流量 (千元) | -302498628 |
| financing_cash_flow | REAL | 融資活動現金流量 (千元) | -123456789 |
| free_cash_flow | REAL | 自由現金流量 (千元) | 154290495 |

#### `dividend_policy` - 股利政策表
記錄年度股利發放相關資料

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| year | INTEGER | 股利發放年度 | 2023 |
| cash_dividend | REAL | 現金股利 (元/股) | 11.0 |
| stock_dividend | REAL | 股票股利 (股/股) | 0.0 |
| total_dividend | REAL | 總股利 (元/股) | 11.0 |
| payout_ratio | REAL | 股利發放率 (%) | 63.5 |
| ex_dividend_date | DATE | 除息日 | "2023-07-20" |

### 💸 資金流向相關表

#### `fundflow` - 資金流向表
記錄三大法人每日買賣超資料

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| date | DATE | 交易日期 | "2023-06-15" |
| foreign_net | INTEGER | 外資買賣超 (張) | 5432 |
| inv_trust_net | INTEGER | 投信買賣超 (張) | -1234 |
| holding_ratio | REAL | 外資持股比例 (%) | 78.5 |

### 📊 技術指標相關表

#### `technical_indicators` - 技術指標表
記錄每日技術分析指標

| 欄位名 | 型別 | 說明 | 範例 |
|--------|------|------|------|
| stock_no | TEXT | 股票代號 | "2330" |
| date | DATE | 交易日期 | "2023-06-15" |
| ma_5 | REAL | 5日移動平均線 (元) | 451.2 |
| ma_20 | REAL | 20日移動平均線 (元) | 448.7 |
| ma_60 | REAL | 60日移動平均線 (元) | 445.3 |
| rsi | REAL | RSI相對強弱指標 (0-100) | 67.8 |
| macd | REAL | MACD指標 | 2.15 |

### 🛠 系統管理表

#### `migration_history` - 資料庫遷移紀錄表
記錄已套用的資料庫 migration

| 欄位名 | 型別 | 說明 |
|--------|------|------|
| filename | TEXT | migration 檔名 |
| executed_at | DATETIME | 執行時間 |

### 🔍 綜合視圖

#### `stock_comprehensive_view` - 綜合查詢視圖
整合各表資料，方便快速查詢個股的綜合資訊

此視圖結合了以下資料：
- 每日股價 (price_daily)
- 估值指標 (valuation)
- 品質指標 (quality)
- 資金流向 (fundflow)

## 索引設計

為了提升查詢效能，系統為每個主要查詢欄位建立索引：

- `idx_growth_month` - 成長表月份索引
- `idx_quality_year` - 品質表年度索引
- `idx_fundflow_date` - 資金流向表日期索引
- `idx_balance_sheet_date` - 資產負債表日期索引
- `idx_cash_flow_date` - 現金流量表日期索引
- `idx_dividend_policy_year` - 股利政策表年度索引
- `idx_technical_indicators_date` - 技術指標表日期索引

## 資料來源對應

| 資料表 | 主要 FinMind API 端點 | 更新頻率 |
|--------|----------------------|----------|
| price_daily | TaiwanStockPrice | 每日 |
| valuation | TaiwanStockPER | 每日 |
| growth | TaiwanStockMonthRevenue | 每月 |
| quality | TaiwanStockFinancialStatements | 每季 |
| balance_sheet | TaiwanStockBalanceSheet | 每季 |
| cash_flow | TaiwanStockCashFlowsStatement | 每季 |
| dividend_policy | TaiwanStockDividend | 每年 |
| fundflow | TaiwanStockInstitutionalInvestors | 每日 |

## 注意事項

1. **主鍵設計**: 大部分表使用 (stock_no, date) 或 (stock_no, year) 作為複合主鍵
2. **資料單位**: 金額通常以千元為單位，股價以元為單位
3. **日期格式**: 統一使用 YYYY-MM-DD 格式
4. **NULL 值處理**: 某些指標可能因資料不足而為 NULL
5. **資料完整性**: 建議定期檢查資料完整性和一致性
