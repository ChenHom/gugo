-- 擴展資料庫表結構以支援 FinMind API 新增的資料集
-- 使用安全的方式添加欄位，避免重複添加錯誤

-- 檢查並創建新的資料表（如果不存在）
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
