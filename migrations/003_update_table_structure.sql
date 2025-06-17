-- 更新現有表結構以支援新欄位
-- 此 migration 專門處理現有表的欄位擴展

-- 重建 price_daily 表以支援完整的 OHLCV 資料
CREATE TABLE IF NOT EXISTS price_daily_new (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  close REAL,
  open REAL,
  high REAL,
  low REAL,
  volume INTEGER,
  turnover REAL,
  PRIMARY KEY (stock_no, date)
);

-- 遷移現有資料
INSERT OR IGNORE INTO price_daily_new (stock_no, date, close, volume)
SELECT stock_no, date, close, volume FROM price_daily WHERE stock_no IS NOT NULL;

-- 替換表
DROP TABLE price_daily;
ALTER TABLE price_daily_new RENAME TO price_daily;

-- 重建 valuation 表以支援更多欄位
CREATE TABLE IF NOT EXISTS valuation_new (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  per REAL,
  pbr REAL,
  per_percentile REAL,
  pbr_percentile REAL,
  dividend_yield REAL,
  dividend_per_share REAL,
  market_value REAL,
  PRIMARY KEY (stock_no, date)
);

-- 遷移現有資料
INSERT OR IGNORE INTO valuation_new (stock_no, date, per, pbr, dividend_yield)
SELECT stock_no, date, per, pbr, dividend_yield FROM valuation WHERE stock_no IS NOT NULL;

-- 替換表
DROP TABLE valuation;
ALTER TABLE valuation_new RENAME TO valuation;

-- 創建綜合視圖
CREATE VIEW IF NOT EXISTS stock_comprehensive_view AS
SELECT
  p.stock_no,
  p.date,
  p.close,
  p.volume,
  v.per,
  v.pbr,
  v.dividend_yield,
  v.market_value,
  q.roe,
  q.gross_margin,
  q.op_margin,
  f.foreign_net,
  f.inv_trust_net,
  f.holding_ratio
FROM price_daily p
LEFT JOIN valuation v ON p.stock_no = v.stock_no AND p.date = v.date
LEFT JOIN quality q ON p.stock_no = q.stock_no AND strftime('%Y', p.date) = CAST(q.year AS TEXT)
LEFT JOIN fundflow f ON p.stock_no = f.stock_no AND p.date = f.date;
