-- 擴展資料庫表結構以支援 FinMind API 新增的資料集
-- 安全版本：使用 ALTER TABLE 方式逐步添加欄位

-- 為 price_daily 表安全地添加新欄位
ALTER TABLE price_daily ADD COLUMN open REAL;
ALTER TABLE price_daily ADD COLUMN high REAL;
ALTER TABLE price_daily ADD COLUMN low REAL;
ALTER TABLE price_daily ADD COLUMN turnover REAL;

-- 為 valuation 表安全地添加新欄位
ALTER TABLE valuation ADD COLUMN per_percentile REAL;
ALTER TABLE valuation ADD COLUMN pbr_percentile REAL;
ALTER TABLE valuation ADD COLUMN dividend_per_share REAL;
ALTER TABLE valuation ADD COLUMN market_value REAL;

-- 創建新的資料表
CREATE TABLE IF NOT EXISTS balance_sheet (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  total_assets REAL,
  total_liabilities REAL,
  equity REAL,
  cash_and_equivalents REAL,
  inventory REAL,
  receivables REAL,
  debt_ratio REAL,
  PRIMARY KEY (stock_no, date)
);

CREATE TABLE IF NOT EXISTS cash_flow (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  operating_cash_flow REAL,
  investing_cash_flow REAL,
  financing_cash_flow REAL,
  free_cash_flow REAL,
  PRIMARY KEY (stock_no, date)
);

CREATE TABLE IF NOT EXISTS dividend_policy (
  stock_no TEXT NOT NULL,
  year INTEGER NOT NULL,
  cash_dividend REAL,
  stock_dividend REAL,
  total_dividend REAL,
  payout_ratio REAL,
  ex_dividend_date DATE,
  PRIMARY KEY (stock_no, year)
);

CREATE TABLE IF NOT EXISTS technical_indicators (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  ma_5 REAL,
  ma_20 REAL,
  ma_60 REAL,
  rsi REAL,
  macd REAL,
  PRIMARY KEY (stock_no, date)
);

-- 建立索引以提升查詢效能
CREATE INDEX IF NOT EXISTS idx_price_daily_date ON price_daily(date);
CREATE INDEX IF NOT EXISTS idx_valuation_date ON valuation(date);
CREATE INDEX IF NOT EXISTS idx_growth_month ON growth(month);
CREATE INDEX IF NOT EXISTS idx_quality_year ON quality(year);
CREATE INDEX IF NOT EXISTS idx_fundflow_date ON fundflow(date);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_date ON balance_sheet(date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(date);
CREATE INDEX IF NOT EXISTS idx_dividend_policy_year ON dividend_policy(year);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_date ON technical_indicators(date);

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
