# CLI 改進摘要

## 完成的改進

### 1. 信號處理機制 (Signal Handling)
- **新增檔案**: `src/utils/signalHandler.ts`
- **功能**:
  - 統一處理 SIGINT (Ctrl+C) 和 SIGTERM 信號
  - 優雅退出機制，確保資源正確釋放
  - 支援自定義清理函數

### 2. 批次處理工具 (Batch Processing)
- **新增檔案**: `src/utils/batchProcessor.ts`
- **功能**:
  - 批次處理多個項目，支援錯誤跳過
  - 內建重試機制和延遲控制
  - 進度顯示和錯誤統計
  - 針對 402 Payment Required 錯誤的友善提示

### 3. 修改的 CLI 檔案

#### ✅ 已完成
- `src/cli/fetch-all.ts` - 所有資料抓取
- `src/cli/fetch-valuation.ts` - 估值資料抓取
- `src/cli/fetch-growth.ts` - 成長資料抓取（重寫）
- `src/cli/fetch-quality.ts` - 品質資料抓取
- `src/cli/fetch-fund-flow.ts` - 資金流資料抓取
- `src/cli/fetch-momentum.ts` - 動能資料抓取
- `src/cli/fetch-price.ts` - 價格資料抓取

#### 🔄 待處理
- `src/cli/update.ts` - 資料更新（需要信號處理）
- `src/cli/update-stock-list.ts` - 股票清單更新
- 其他非關鍵 CLI 檔案

## 關鍵改進特性

### 1. FinMind API 402 錯誤處理
- 偵測 402 Payment Required 錯誤
- 顯示友善的錯誤訊息
- 自動跳過失敗的股票，不中斷整體流程

### 2. 可中斷的執行
- 所有修改過的 CLI 現在都可以用 Ctrl+C 安全中斷
- 自動清理資料庫連接和其他資源
- 顯示適當的退出訊息

### 3. 錯誤容錯機制
- 單一股票失敗不會導致整個程序失敗
- 批次處理支援重試機制
- 詳細的成功/失敗統計

### 4. 改善的用戶體驗
- 進度顯示和狀態更新
- 清晰的錯誤訊息
- 批次處理結果摘要

## 測試結果

### ✅ 編譯測試
- TypeScript 編譯成功，無語法錯誤

### ✅ 單元測試
- 所有 129 個測試通過
- 無破壞性變更

### ✅ CLI 功能測試
- Help 選項正常運作
- 命令列參數解析正確

## 使用範例

```bash
# 抓取指定股票的品質資料（可被 Ctrl+C 中斷）
npm run fetch-quality -- --stocks 2330,2454,2317

# 抓取所有資料（自動跳過 402 錯誤）
npm run fetch-all

# 抓取動能資料（支援批次處理）
npm run fetch-momentum -- --stocks 2330,2317 --days 30
```

## 技術細節

### SignalHandler 使用方式
```typescript
const signalHandler = setupCliSignalHandler('command-name');
signalHandler.addCleanupFunction(async () => {
  await dbManager.close();
});
```

### BatchProcessor 使用方式
```typescript
const results = await processItems(
  items,
  async (item) => { /* 處理邏輯 */ },
  {
    batchSize: 5,
    maxRetries: 2,
    skipOnError: true,
    retryDelay: 1000
  }
);
```

## 下一步

1. 繼續修改 `update.ts` 和其他長時間運行的 CLI
2. 考慮實施 TWSE OpenAPI 優先級機制
3. 添加更多的錯誤處理和恢復機制
4. 實施配置檔案來管理 API 偏好設定
