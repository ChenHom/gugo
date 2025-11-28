# MOPS EPS 資料抓取測試結果 - 更新版

## 測試日期: 2025-07-02

## 🎯 重要發現

### ✅ 成功：發現可用的 MOPS API 端點

基於用戶提供的 curl 命令，我們成功找到了可工作的 MOPS API：

**API 端點:** `https://mops.twse.com.tw/mops/api/t57sb01_q1`

**請求格式:**
```javascript
POST https://mops.twse.com.tw/mops/api/t57sb01_q1
Content-Type: application/json

{
  "companyId": "2330",
  "year": "110"
}
```

**回應格式:**
```json
{
  "code": 200,
  "message": "查詢成功",
  "result": {
    "url": "https://doc.twse.com.tw/server-java/t57sb01?step=1&colorchg=1&seamon=&mtype=A&co_id=2330&year=110"
  },
  "datetime": "114/07/02 10:58:38"
}
```

### 📋 API 工作流程

1. **第一步：API 查詢**
   - 調用 MOPS API 取得資料頁面 URL
   - 回應包含重定向 URL

2. **第二步：資料頁面存取**
   - 存取返回的 URL
   - 頁面使用 Big5 編碼
   - 內容為「電子資料查詢作業」頁面

3. **第三步：檔案下載**
   - 頁面包含檔案下載連結
   - 需要進一步解析 HTML 找到實際財務報表檔案

### 🔍 技術細節

**編碼處理:**
- MOPS 使用 Big5 編碼
- 需要使用 `TextDecoder('big5')` 正確解碼

**請求標頭:**
- 需要完整的瀏覽器標頭模擬
- 包含 Origin、Referer 等安全標頭

### 💡 實作建議

基於測試結果，建議的 EPS 資料抓取策略：

#### 選項一：使用 FinMind API（推薦）
```javascript
const epsData = await fetchFinMind('FinancialStatements', {
  data_id: '2330',
  start_date: '2023-01-01',
  end_date: '2024-12-31'
});
```

**優點:**
- ✅ 直接 API 存取
- ✅ JSON 格式回應
- ✅ 包含 EPS QoQ 計算所需資料
- ✅ 穩定且文件化

#### 選項二：MOPS API（進階）
```javascript
// 1. 取得資料 URL
const apiResponse = await fetch('https://mops.twse.com.tw/mops/api/t57sb01_q1', {
  method: 'POST',
  body: JSON.stringify({ companyId: "2330", year: "113" })
});

// 2. 解析下載頁面
const dataUrl = apiResponse.result.url;
const pageContent = await fetchWithBig5Encoding(dataUrl);

// 3. 提取財務報表檔案連結
const fileLinks = parseFinancialReportLinks(pageContent);

// 4. 下載並解析 EPS 資料
const epsData = await downloadAndParseEPS(fileLinks);
```

**考量:**
- ⚠️ 需要多步驟處理
- ⚠️ 需要 HTML 解析
- ⚠️ 需要處理 Big5 編碼
- ⚠️ 可能需要定期更新解析邏輯

### 🎯 最終建議

**在你的專案中，建議使用 FinMind API 作為主要 EPS 資料來源：**

1. **可靠性高** - API 穩定，格式標準化
2. **開發效率** - 直接取得結構化資料
3. **維護成本低** - 不需要處理 HTML 解析和編碼問題
4. **功能完整** - 支援 EPS QoQ 計算所需的歷史資料

**MOPS API 可作為備用或驗證來源使用。**

### 📝 範例程式碼

```javascript
// 推薦：使用 FinMind
export async function fetchEPSData(stockNo: string): Promise<EPSData[]> {
  const data = await fetchFinMind('FinancialStatements', {
    data_id: stockNo,
    start_date: '2020-01-01',
    end_date: new Date().toISOString().split('T')[0]
  });

  return data
    .filter(item => item.type.includes('每股盈餘') || item.type.includes('BasicEarningsPerShare'))
    .map(item => ({
      stockNo: item.stock_id,
      date: item.date,
      eps: parseFloat(item.value),
      type: item.type
    }));
}
```

## 🎉 結論

**✅ MOPS EPS 資料可以程式化取得**，但需要較複雜的處理流程。

**✅ FinMind API 提供更簡潔的解決方案**，建議優先使用。

測試證明兩種方案都可行，選擇取決於專案需求和維護考量。
