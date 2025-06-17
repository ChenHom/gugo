-- 建立台灣高潛力股票篩選系統的主要資料表
CREATE TABLE IF NOT EXISTS valuation (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  per REAL,
  pbr REAL,
  dividend_yield REAL,
  PRIMARY KEY (stock_no, date)
);

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

CREATE TABLE IF NOT EXISTS price_daily (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  close REAL,
  volume INTEGER,
  PRIMARY KEY (stock_no, date)
);
