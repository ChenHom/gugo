---
applyTo: "tests/**"
---

# 測試檔案組織規範

## 檔案結構規範

### 目錄結構

測試檔案必須按功能模組分類組織，遵循以下結構：

```
tests/
├── unit/                    # 單元測試
│   ├── fetchers/           # 資料擷取器測試
│   ├── services/           # 服務層測試
│   ├── utils/              # 工具模組測試
│   └── cli/                # CLI 指令測試
├── integration/            # 整合測試
│   ├── database/           # 資料庫整合測試
│   ├── api/                # API 整合測試
│   └── workflow/           # 工作流程測試
└── e2e/                    # 端到端測試
    ├── complete-flow/      # 完整流程測試
    └── cli-scenarios/      # CLI 場景測試
```

### 命名規則

1. **統一檔案後綴**：所有測試檔案使用 `.test.ts` 後綴
2. **命名模式**：
   - 單元測試：`{moduleName}.test.ts`
   - 整合測試：`{featureName}.integration.test.ts`
   - E2E 測試：`{scenarioName}.e2e.test.ts`

### 測試分類原則

#### 單元測試 (Unit Tests)

- 測試單一功能模組或類別
- 不依賴外部資源（資料庫、API、檔案系統）
- 使用 mock 和 stub 隔離依賴
- 執行速度快，可頻繁執行

#### 整合測試 (Integration Tests)

- 測試多個模組間的協作
- 可能使用真實的資料庫或 API
- 驗證不同組件間的介面和資料流
- 執行時間較長，適合 CI/CD 流程

#### 端到端測試 (E2E Tests)

- 測試完整的使用者場景
- 從 CLI 指令到最終輸出的完整流程
- 使用真實環境和資料
- 執行時間最長，通常在發布前執行

#### 專案規範與技術棧

- 嚴格遵循 TypeScript/ESM 專案規範，import 必須用 .js 副檔名。
- CLI 指令說明僅記錄於 docs/cli_usage.md。
- commit message 需符合 conventional commits，並聚焦單一邏輯變更。

## 測試組織實例

### ❌ 錯誤組織方式

```
tests/
├── cli.test.ts
├── cli-comprehensive.test.ts
├── cli-edge-cases.test.ts     # 分散的 CLI 測試
├── momentumFetcher.test.ts    # 混合 .test.ts 和 .spec.ts
├── factorAnalysis.spec.ts     # 命名不一致
```

### ✅ 正確組織方式

```
tests/
├── unit/
│   ├── fetchers/
│   │   ├── momentumFetcher.test.ts
│   │   ├── growthFetcher.test.ts
│   │   └── qualityFetcher.test.ts
│   ├── services/
│   │   ├── scoringEngine.test.ts
│   │   └── dataCleaner.test.ts
│   └── cli/
│       ├── rank.test.ts
│       └── explain.test.ts
├── integration/
│   ├── database/
│   │   └── fetcher-db.integration.test.ts
│   └── workflow/
│       └── data-pipeline.integration.test.ts
└── e2e/
    └── complete-flow/
        └── fetch-rank-explain.e2e.test.ts
```

## 共用測試工具

### 建立共用設定

創建 `tests/utils/` 目錄存放共用的測試工具：

- `testDbSetup.ts` - 測試資料庫設定
- `mockData.ts` - 模擬資料
- `testHelpers.ts` - 測試輔助函數

### 避免重複代碼

- 使用共用的 `beforeEach` 和 `afterEach` 設定
- 建立可重用的 mock 工廠函數
- 統一錯誤處理測試模式

## 測試品質要求

1. **描述清晰**：測試名稱要明確描述測試的功能和預期結果
2. **獨立執行**：每個測試都能獨立執行，不依賴其他測試的結果
3. **快速回饋**：單元測試執行時間應控制在毫秒級別
4. **覆蓋率**：核心業務邏輯測試覆蓋率應達到 90% 以上

## 遷移指導(如有需要)

### 現有檔案遷移規則

1. 將 `.spec.ts` 重命名為 `.test.ts`
2. 按功能分類移動到對應目錄
3. 合併相關的測試檔案（如 CLI 相關測試）
4. 重構重複的測試設定代碼

### 逐步遷移策略

1. 先建立新的目錄結構
2. 移動和重命名檔案
3. 更新 import 路徑
4. 合併重複的測試邏輯
5. 驗證所有測試正常執行

## 測試修正與通過注意事項

1. **測試檔案搬移與命名**
   - 未來如有檔案搬移、合併、重命名，需同步修正所有 import 路徑與測試內容，並依 test-organization.instructions.md 分類。

2. **測試覆蓋率與獨立性**
   - 維持高測試覆蓋率（≥90%），確保所有測試獨立、快速、可重複執行。
   - 新增功能或重構時，務必同步新增或調整測試。

3. **mock 與快取**
   - 測試必須 mock 所有外部 API，嚴禁誤用真實 API 或快取資料。
   - 若發現 mock 無效，需檢查 setup.ts、vitest.config.ts、tsconfig.json 設定。

4. **CI/CD 與自動化**
   - 確認 CI/CD pipeline 能正確執行所有測試，並符合覆蓋率要求。
   - 任何 CLI、API、DB schema 變動，需同步調整相關測試與文件。

5. **專案規範持續遵循**
   - 持續遵循 coding standards、commit message、文件規範等，確保專案品質與可維護性。

> 如有新需求或異動，請務必同步更新測試、mock 設定與相關文件，確保專案穩定運作。
