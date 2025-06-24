-- 新增股票清單和元資料表

CREATE TABLE IF NOT EXISTS stock_list (
  stockNo   TEXT PRIMARY KEY,
  name      TEXT,
  industry  TEXT,
  market    TEXT,      -- 上市/上櫃/興櫃
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS meta (
  key       TEXT PRIMARY KEY,
  value     TEXT,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_stock_list_market ON stock_list(market);
CREATE INDEX IF NOT EXISTS idx_stock_list_industry ON stock_list(industry);
CREATE INDEX IF NOT EXISTS idx_stock_list_updated ON stock_list(updatedAt);

-- 插入初始測試資料
INSERT OR REPLACE INTO stock_list (stockNo, name, industry, market) VALUES
('2330', '台積電', '半導體業', '上市'),
('2317', '鴻海', '電子業', '上市'),
('2454', '聯發科', '半導體業', '上市');

-- 設定初始 meta 資料
INSERT OR REPLACE INTO meta (key, value) VALUES
('stock_list_last_updated', datetime('now'));