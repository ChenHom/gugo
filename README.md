# 台灣高潛力股票篩選系統 | Taiwan High-Potential Stock Screener 🇹🇼

一個全自動化的台灣股票分析和篩選系統，基於多因子量化分析模型，幫助投資者識別具有高成長潛力的股票。

*A comprehensive automated Taiwan stock analysis and screening system based on multi-factor quantitative models to help investors identify high-growth potential stocks. [English documentation](README.en.md)*

## 🚀 功能特色

### 📊 多因子分析

- **估值因子**: P/E比、P/B比、股息殖利率
- **成長因子**: 營收年增率、EPS季增率、營收月增率
- **品質因子**: ROE、負債比、流動比率、現金流品質
- **資金流因子**: 外資買賣超、投信動向、法人持股比例
- **動能因子**: RSI、移動平均、價格動能、成交量比率

### 🔄 自動化資料處理

- **智慧抓取**: 自動從台灣證交所 OpenAPI 抓取最新資料
- **資料清理**: 自動處理異常值、缺失值和錯誤資料
- **快取機制**: 提升資料獲取效率，避免重複請求
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

### 🛠️ 完整的 CLI 工具

- **資料抓取**: 支持全量和增量資料抓取
- **股票排名**: 快速查看高潛力股票排行
- **詳細分析**: 單一股票深度分析和解釋
- **視覺化**: 多種圖表和統計報告
- **資料管理**: 資料更新、清理和維護

## 📦 安裝與設置

### 系統要求

- Node.js 18+
- npm 或 yarn
- TypeScript 4.5+

### 安裝步驟

1. **克隆專案**

```bash
git clone <repository-url>
cd taiwan-stock-screener
```

2. **安裝依賴**

```bash
npm install
```

3. **編譯專案**

```bash
npm run build
```

4. **初始化資料庫**

```bash
# 資料庫會在第一次運行時自動創建
npm run fetch-all
```

## 🎮 使用指南

### 資料抓取

```bash
# 抓取所有資料
npm run fetch-all

# 抓取特定因子資料
npm run fetch-valuation    # 估值資料
npm run fetch-growth        # 成長資料
npm run fetch-quality       # 品質資料
npm run fetch-fund-flow     # 資金流資料
npm run fetch-momentum      # 動能資料
```

### 股票分析

```bash
# 查看股票排行榜
npm run rank

# 查看前20名股票
npm run rank -- --limit 20

# 指定權重配置
npm run rank -- --valuation 0.5 --growth 0.3 --quality 0.2

# 分析特定股票
npm run explain 2330        # 分析台積電
npm run explain 2454 -- --verbose  # 詳細分析
```

### 視覺化分析

```bash
# 顯示系統摘要
npm run visualize

# 顯示前20名排行榜
npm run visualize -- --type top --limit 20

# 顯示分數分佈
npm run visualize -- --type distribution

# 比較多檔股票
npm run visualize -- --type comparison --stocks "2330,2454,2317"

# 顯示趨勢圖
npm run visualize -- --type trend --stocks 2330 --factor valuation
```

### 資料管理

```bash
# 更新所有資料
npm run update

# 強制更新（忽略快取）
npm run update -- --force

# 更新特定因子
npm run update -- --factors "valuation,growth"

# 更新特定股票
npm run update -- --stocks "2330,2454"

# 清理舊資料
npm run update -- --clean

# 查看更新狀態
npm run update -- --status
```

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

1. **資料標準化**: 使用 Z-Score 標準化各項指標
2. **異常值處理**: 自動識別和處理極端值
3. **缺失值處理**: 智慧填補缺失資料
4. **因子合成**: 加權平均計算各因子分數
5. **總分計算**: 各因子按權重加總得出最終分數

## 🧪 測試

```bash
# 執行所有測試
npm test

# 執行測試並查看覆蓋率
npm run test:coverage

# 執行特定測試
npm test -- src/services/dataCleaner.test.ts
```

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

⚠️ **已知限制:**
- **月營收資料**: TWSE OpenAPI 目前無法提供月營收數據，`t187ap02_M` 端點無效
- **EPS資料**: `t51apim03_A` 端點目前無法正常使用
- **資金流資料**: 需要從其他來源獲取外資投信買賣超資料

### 資料來源狀態

| 資料類型 | TWSE OpenAPI 狀態 | 替代方案 |
|---------|------------------|----------|
| 股價資料 | ✅ 可用 | - |
| 估值指標 (PE/PB) | ✅ 可用 | - |
| 月營收 | ❌ 端點無效 | 考慮使用公開資訊觀測站 |
| EPS 資料 | ❌ 端點無效 | 需要手動獲取或其他 API |
| 財務指標 | ⚠️ 待測試 | - |
| 資金流向 | ❌ 端點無效 | 需要其他資料源 |

### 建議的解決方案

如果您需要完整的多因子分析，建議：
1. 使用現有可用的估值和價格資料進行基礎分析
2. 手動補充月營收和 EPS 資料
3. 考慮使用付費金融 API 服務
4. 等待 TWSE OpenAPI 恢復相關端點

## 📝 開發指南

### 程式碼品質

```bash
# 檢查程式碼風格
npm run lint

# 自動修正程式碼風格
npm run lint:fix

# 型別檢查
npm run typecheck
```

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
