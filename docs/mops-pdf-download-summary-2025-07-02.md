# MOPS PDF 下載測試總結報告

## 測試日期: 2025-07-02

## 🎯 目標
取得包含 EPS 資料的 MOPS 財務報表 PDF 檔案

## 📋 測試結果

### 測試 curl

```cli
curl 'https://mops.twse.com.tw/mops/api/t57sb01_q1' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,en-GB;q=0.6,zh-HK;q=0.5' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -b '_ga_J2HVMN6FVP=GS2.1.s1750051919$o3$g1$t1750051950$j29$l0$h0; _ga=GA1.1.2140230247.1749869999; _ga_HF4MS5TH1P=GS2.1.s1750164243$o2$g0$t1750164243$j60$l0$h0; JSESSIONID=FD442A9AABFFDCFF0AE9170505BAD14D; _ga_EJ69TXS89Q=GS2.1.s1751422890$o1$g0$t1751422890$j60$l0$h0' \
  -H 'DNT: 1' \
  -H 'Origin: https://mops.twse.com.tw' \
  -H 'Pragma: no-cache' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-origin' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0' \
  -H 'content-type: application/json' \
  -H 'sec-ch-ua: "Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"companyId":"2330","year":"110"}'
```

### ✅ 成功發現的內容

1. **API 端點可用**
   - `https://mops.twse.com.tw/mops/api/t57sb01_q1` 正常工作
   - 可成功取得資料頁面 URL

2. **PDF 檔案清單已識別**
   - 找到 10 個 PDF 檔案連結
   - 檔案命名格式：`YYYYMM_STOCKNO_TYPE.pdf`
   - 例如：`202401_2330_AI1.pdf`, `202401_2330_AIA.pdf`

3. **檔案類型分析**
   - `AI1.pdf`: IFRSs合併財報
   - `AIA.pdf`: IFRSs英文版-合併財報
   - `AI3.pdf`: IFRSs個體財報
   - `AIC.pdf`: IFRSs英文版-個體財報

### ❌ 遇到的問題

1. **下載認證問題**
   - 所有 PDF 下載請求都返回 HTML 錯誤頁面
   - 需要額外的 session 或認證機制
   - 可能需要 CAPTCHA 驗證或特殊 token

2. **測試的下載方法都失敗**
   - 直接 URL 存取：404 錯誤
   - 表單提交模擬：返回錯誤 HTML
   - Session 管理：仍無法突破認證

## 💡 解決方案

### 選項二：手動下載 + 自動處理

```javascript
// 1. 提供手動下載指引
console.log('請手動下載以下 PDF 檔案:');
console.log('1. https://mops.twse.com.tw/mops/web/t57sb01');
console.log('2. 輸入股票代號: 2330');
console.log('3. 選擇年度: 2024');
console.log('4. 下載 AI1.pdf (合併財報)');

// 2. 自動處理本地 PDF 檔案
const pdfData = await processPDFFile('./downloads/202401_2330_AI1.pdf');
const eps = extractEPSFromPDF(pdfData);
```

### 選項三：使用 Selenium 自動化

```javascript
// 使用 Selenium WebDriver 模擬真實瀏覽器操作
const driver = await new Builder().forBrowser('chrome').build();
await driver.get('https://mops.twse.com.tw/mops/web/t57sb01');
// ... 自動填表、下載檔案
```

**考量:**
- ⚠️ 需要安裝額外套件
- ⚠️ 效能較差
- ⚠️ 維護複雜

### MOPS 驗證

```typescript
export async function verifyEPSWithMOPS(stockNo: string, year: string): Promise<boolean> {
  try {
    // 1. 調用 MOPS API 確認資料存在
    const apiResponse = await fetch('https://mops.twse.com.tw/mops/api/t57sb01_q1', {
      method: 'POST',
      body: JSON.stringify({ companyId: stockNo, year })
    });

    const result = await apiResponse.json();
    return result.code === 200;

  } catch (error) {
    return false;
  }
}
```

## 🔄 未來改進方向

1. **研究 MOPS 認證機制**
   - 分析 JavaScript 程式碼
   - 研究可能的 token 生成方式
   - 嘗試模擬完整的瀏覽器環境

2. **PDF 處理能力**
   - 如果未來成功下載 PDF，需要 PDF 解析工具
   - 建議使用 `pdf-parse` 或類似套件

3. **定期監控**
   - MOPS 可能更新認證機制
   - 需要定期檢查 API 可用性


