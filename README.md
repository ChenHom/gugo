# Taiwan High-Potential Stock Screener

依據台灣高潛力股票篩選規格（見 .github/instructions/taiwan-high‑potential-stock-screener.instructions.md），本專案以 TypeScript + Node.js 開發，具備 CLI、SQLite 快取、API 抓取、分數計算、單元測試等功能。

## 主要指令
- `npm run fetch-all`：抓取所有資料
- `npm run fetch-valuation`：抓取估值資料
- `npm run rank`：依分數排名
- `npm run explain <stockCode>`：顯示個股分數與原始數據
- `npm test`：執行單元測試

## 資料表 Schema
見 `migrations/001_init_schema.sql`

## 依賴
- better-sqlite3
- node-fetch
- yargs
- vitest
- typescript
- eslint

## 開發規範
- 詳見 `.github/instructions/` 內規格與 coding style
