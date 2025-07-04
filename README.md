# 台灣高潛力股票篩選系統 | Taiwan High-Potential Stock Screener 🇹🇼

一個全自動化的台灣股票分析和篩選系統，基於多因子量化分析模型，幫助投資者識別具有高成長潛力的股票。

*A comprehensive automated Taiwan stock analysis and screening system based on multi-factor quantitative models to help investors identify high-growth potential stocks. [English documentation](README.en.md)*

## 🚀 功能特色

### 📊 多因子分析

- **估值因子**: P/E比、P/B比、股息殖利率
- **成長因子**: 營收年增率、EPS季增率、營收月增率
- **品質因子**: ROE、負債比、流動比率、現金流品質
- **資金流因子**: 外資買賣超、投信動向、法人持股比例
- **動能因子**: RSI、移動平均(MA5/MA20/MA60)、MACD、布林通道、價格動能、成交量比率

### 🔄 自動化資料處理

- **智慧抓取**: 自動從台灣證交所 OpenAPI 抓取最新資料
- **資料清理**: 自動處理異常值、缺失值和錯誤資料
- **快取機制**: 提升資料獲取效率，避免重複請求
- **流動性調整**: 依平均日成交量將持股限制在 10% 以內
- **增量更新**: 支持增量更新和強制刷新

### 🎯 智慧評分系統

- **Z-Score標準化**: 確保各因子評分的公平性
- **權重配置**: 可自定義各因子權重
- **綜合評分**: 多因子加權計算總分
- **排名系統**: 自動產生股票排行榜

### 📈 視覺化分析

- **ASCII圖表**: 在命令列中直接查看圖表
- **多種圖表類型**: 柱狀圖、折線圖、分佈圖
- **因子比較**: 多股票多因子對比分析
- **趨勢分析**: 時間序列分析
- **風險度量**: 透過 1000 次 bootstrap 估算最大回撤的 95% 信賴區間（可透過 `npm run bootstrap-pnl` 產生）

### 🛠️ 完整的 CLI 工具

- **資料抓取**: 支持全量和增量資料抓取
- **股票排名**: 快速查看高潛力股票排行
- **詳細分析**: 單一股票深度分析和解釋
- **視覺化**: 多種圖表和統計報告
- **資料管理**: 資料更新、清理和維護
- **參數優化**: 一次測試多組持股數與再平衡週期並輸出熱圖（執行 `npm run optimize`）

## 📦 安裝與設置

### 系統要求

- Node.js 18+
- npm 或 yarn
- TypeScript 4.5+

### 安裝步驟

1. **克隆專案**

```bash
git clone https://github.com/ChenHom/gugo
cd taiwan-stock-screener
```

2. **安裝依賴**

```bash
npm install
```

3. **編譯專案**：`npm run build`

4. **初始化資料庫**：`npm run fetch-all`

## 🎮 使用指南
更多 CLI 指令請參見 [docs/cli_usage.md](docs/cli_usage.md)



### 初次設定

1. **設定 FinMind API Token** (建議)：
   ```bash
   # 複製環境變數範例檔案
   cp .env.example .env

   # 編輯 .env 檔案設定您的 Token
   # FINMIND_TOKEN=your_token_here
   ```

### 範例流程

以下範例展示從抓取資料到排名與回測的基本操作：

1. **抓取資料**：執行 `npm run fetch-all`（或分別執行 `npm run fetch-*`）以建立資料庫，終端會顯示各項資料的下載進度。

2. **計算排名**：使用 `npm run rank` 產生股票排名表，依綜合分數由高到低輸出。

3. **執行回測**：透過 `npm run backtest` 指定起始與結束日期進行歷史回測，完成後會輸出 CAGR、MDD 等統計並儲存 `backtest_<date>.json`。


## 🏗️ 專案架構

```
src/
├── cli/                    # CLI 指令
│   ├── fetch-all.ts       # 全量資料抓取
│   ├── fetch-valuation.ts # 估值資料抓取
│   ├── fetch-growth.ts    # 成長資料抓取
│   ├── fetch-quality.ts   # 品質資料抓取
│   ├── fetch-fund-flow.ts # 資金流資料抓取
│   ├── fetch-momentum.ts  # 動能資料抓取
│   ├── rank.ts           # 股票排名
│   ├── explain.ts        # 股票分析
│   ├── visualize.ts      # 視覺化
│   └── update.ts         # 資料更新
├── fetchers/              # 資料抓取器
│   ├── valuationFetcher.ts
│   ├── growthFetcher.ts
│   ├── qualityFetcher.ts
│   ├── fundFlowFetcher.ts
│   └── momentumFetcher.ts
├── services/              # 核心服務
│   ├── apiClient.ts      # API 客戶端
│   ├── dataCleaner.ts    # 資料清理
│   ├── dataTransformer.ts# 資料轉換
│   ├── scoringEngine.ts  # 評分引擎
│   ├── visualizer.ts     # 視覺化服務
│   └── dataUpdater.ts    # 資料更新器
├── utils/                 # 工具模組
│   ├── databaseManager.ts# 資料庫管理
│   ├── cacheManager.ts   # 快取管理
│   └── errorHandler.ts   # 錯誤處理
├── types/                 # 型別定義
│   └── index.ts
├── constants/             # 常數定義
│   └── index.ts
└── index.ts              # 主程式入口
```

## 📊 資料來源

- **台灣證券交易所 (TWSE) OpenAPI**
  - 每日收盤行情
  - 本益比、股價淨值比
  - 月營收資料
  - 季報 EPS 資料

  - 外資投信買賣超

## Scoring

使用 `calcScore(stockNo)` 計算單一股票分數，預設權重 40/25/15/10/10。

## 🧮 評分算法


### 因子權重 (預設)

```typescript
{
  valuation: 0.4,   // 估值 40%
  growth: 0.25,     // 成長 25%
  quality: 0.15,    // 品質 15%
  fundFlow: 0.1,    // 資金流 10%
  momentum: 0.1     // 動能 10%
}
```

### 計分方式

1. **資料標準化**: 依需求可選擇 Z-Score、百分位排名或滾動平均
2. **異常值處理**: 自動識別和處理極端值
3. **缺失值處理**: 智慧填補缺失資料
4. **因子合成**: 加權平均計算各因子分數
5. **總分計算**: 各因子按權重加總得出最終分數

## 📈 性能優化

- **資料快取**: 避免重複 API 請求
- **增量更新**: 只更新變更的資料
- **批次處理**: 大量資料分批處理
- **連接池**: 資料庫連接優化
- **索引優化**: 資料庫查詢優化

## 🔧 配置選項

### 資料庫配置

```typescript
DB_CONFIG = {
  PATH: 'data/fundamentals.db',
  TIMEOUT: 10000,
}
```

### 快取配置

```typescript
CACHE_CONFIG = {
  DIR: '.cache',
  EXPIRY: {
    DAILY: 24 * 60 * 60 * 1000,    // 1 天
    MONTHLY: 30 * 24 * 60 * 60 * 1000,  // 30 天
    YEARLY: 365 * 24 * 60 * 60 * 1000,  // 1 年
  },
}
```

### API 限制配置

```typescript
RATE_LIMIT = {
  REQUESTS_PER_SECOND: 2,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
}
```

## ⚠️ 重要提醒與已知限制

### API 狀態更新 (2025年6月)

目前我們已經發現並修正了台灣證交所 OpenAPI 的部分問題：

✅ **已修正的問題:**
- API 基礎網址：已從 `api.twse.com.tw` 修正為 `openapi.twse.com.tw`
- 估值資料端點：`/v1/exchangeReport/BWIBBU_d` 可正常使用
- 資料格式解析：已適配新的 JSON 物件格式

⚠️ **資料來源狀態更新:**

我們已經實作了 FinMind API 作為替代資料來源，以解決 TWSE OpenAPI 的限制：

### 資料來源對應表

| 需求           | 原端點（已失效）                                      | **新的替代來源**                                                                              | 實作狀態 | 備註                                        |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------- | ------ | ----------------------------------------- |
| **月營收**      | `openapi.twse.com.tw/v1/opendata/t187ap02_M`  | **FinMind — `TaiwanStockMonthRevenue`** ✅                       | ✅ 已實作 | 需要 FinMind Token，免費註冊即可用，速率限制 30 req/min           |
| **EPS / 財報** | `openapi.twse.com.tw/v1/opendata/t51apim03_A` | **FinMind — `FinancialStatements`** ✅                 | ✅ 已實作 | 自動解析每股盈餘欄位並計算季增率                    |
| **三大法人買賣超**  | —                                             | **FinMind — `InstitutionalInvestorsBuySell`** ✅ | ✅ 已實作 | 提供外資、投信、自營商買賣超資料 |

### FinMind API 設定

1. **註冊 FinMind 帳號**: 至 [FinMind](https://finmindtrade.com/) 免費註冊
2. **取得 API Token**: 登入後在個人資料頁面取得 token
3. **設定 Token** (推薦使用環境變數):

   **方法一：使用環境變數**
   ```bash
   # 複製範例環境變數檔案
   cp .env.example .env

   # 編輯 .env 檔案，設定您的 FinMind Token
   FINMIND_TOKEN=your_finmind_api_token_here
   ```

   **方法二：直接設定環境變數**
   ```bash
   export FINMIND_TOKEN=your_token_here
   ```

   **方法三：程式碼中直接傳入**
   ```typescript
   // 在初始化 fetcher 時傳入 token
   const growthFetcher = new GrowthFetcher('your_token_here');
   ```

4. **使用注意事項**:
   - 免費版本有速率限制：30 requests/分鐘
   - 建議使用環境變數以避免 Token 洩露
   - Token 會自動從環境變數 `FINMIND_TOKEN` 讀取

### 目前功能狀態

| 資料類型 | TWSE OpenAPI 狀態 | FinMind API 狀態 | 實際可用性 |
|---------|------------------|----------|----------|
| 股價資料 | ✅ 可用 | - | ✅ 可直接使用 |
| 估值指標 (PE/PB) | ✅ 可用 | - | ✅ 可直接使用 |
| 月營收 | ❌ 端點無效 | ✅ 已實作 | ✅ 需 FinMind Token |
| EPS 資料 | ❌ 端點無效 | ✅ 已實作 | ✅ 需 FinMind Token |
| 財務指標 | ❌ 端點無效 | ✅ 已實作 | ✅ 需 FinMind Token |
| 資金流向 | ❌ 端點無效 | ✅ 已實作 | ✅ 需 FinMind Token |

### 建議的解決方案

如果您需要完整的多因子分析，建議：

1. 設定 FinMind Token 以啟用月營收、EPS、資金流等資料
2. 使用現有可用的估值和價格資料進行基礎分析
3. 考慮升級 FinMind 付費版本以提高速率限制
4. 定期更新資料以保持分析準確性

## 📝 開發指南

### 新增因子

1. 在 `src/types/index.ts` 中定義新的資料型別
2. 在 `src/fetchers/` 中建立新的 fetcher
3. 在 `src/services/scoringEngine.ts` 中新增評分邏輯
4. 更新資料庫 schema
5. 新增對應的測試

### 新增 CLI 指令

1. 在 `src/cli/` 中建立新的 CLI 檔案
2. 在 `package.json` 的 scripts 中新增指令
3. 新增說明文件

## 🚨 注意事項

1. **API 限制**: 請遵守證交所 API 使用限制，避免過度請求
2. **資料延遲**: 資料可能有 15-20 分鐘延遲
3. **投資風險**: 本系統僅供參考，投資有風險，請謹慎評估
4. **資料品質**: 系統會自動處理資料品質問題，但仍建議人工複查重要決策

## 🤝 貢獻指南

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 建立 Pull Request

## 📜 授權條款

本專案採用 MIT 授權條款 - 詳見 [LICENSE](LICENSE) 檔案

## 📞 聯絡方式

如有問題或建議，請建立 GitHub Issue 或發送電子郵件。

---

**免責聲明**: 本系統僅供研究和學習目的，不構成投資建議。投資有風險，請根據自己的風險承受能力做出投資決策。
