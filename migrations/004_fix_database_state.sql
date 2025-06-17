-- 修正資料庫狀態的緊急 Migration
-- 確保資料庫表結構處於一致狀態

-- 檢查並修正 price_daily 表
DROP TABLE IF EXISTS price_daily_temp;

-- 如果 price_daily 不存在，重新創建
CREATE TABLE IF NOT EXISTS price_daily (
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

-- 確保 valuation 表結構正確
CREATE TABLE IF NOT EXISTS valuation_fixed (
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

-- 如果舊的 valuation 表存在，遷移資料
INSERT OR IGNORE INTO valuation_fixed (stock_no, date, per, pbr, dividend_yield)
SELECT stock_no, date, per, pbr, dividend_yield FROM valuation;

-- 替換 valuation 表
DROP TABLE IF EXISTS valuation;
ALTER TABLE valuation_fixed RENAME TO valuation;

-- 確保其他必要表存在
CREATE TABLE IF NOT EXISTS growth (
  stock_no TEXT NOT NULL,
  month DATE NOT NULL,
  revenue INTEGER,
  yoy REAL,
  mom REAL,
  eps REAL,
  eps_qoq REAL,
  PRIMARY KEY (stock_no, month)
);

CREATE TABLE IF NOT EXISTS quality (
  stock_no TEXT NOT NULL,
  year INTEGER NOT NULL,
  roe REAL,
  gross_margin REAL,
  op_margin REAL,
  PRIMARY KEY (stock_no, year)
);

CREATE TABLE IF NOT EXISTS fundflow (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  foreign_net INTEGER,
  inv_trust_net INTEGER,
  holding_ratio REAL,
  PRIMARY KEY (stock_no, date)
);

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

-- 刪除有問題的視圖
DROP VIEW IF EXISTS stock_comprehensive_view;

-- 重新創建視圖
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

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_price_daily_date ON price_daily(date);
CREATE INDEX IF NOT EXISTS idx_valuation_date ON valuation(date);
CREATE INDEX IF NOT EXISTS idx_growth_month ON growth(month);
CREATE INDEX IF NOT EXISTS idx_quality_year ON quality(year);
CREATE INDEX IF NOT EXISTS idx_fundflow_date ON fundflow(date);
CREATE INDEX IF NOT EXISTS idx_balance_sheet_date ON balance_sheet(date);
CREATE INDEX IF NOT EXISTS idx_cash_flow_date ON cash_flow(date);
CREATE INDEX IF NOT EXISTS idx_dividend_policy_year ON dividend_policy(year);
CREATE INDEX IF NOT EXISTS idx_technical_indicators_date ON technical_indicators(date);
