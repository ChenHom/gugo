-- Fix momentum_metrics table structure to match the code expectations
-- Drop and recreate the table with the correct schema

DROP TABLE IF EXISTS momentum_metrics;

CREATE TABLE momentum_metrics (
  stock_no TEXT NOT NULL,
  date DATE NOT NULL,
  ma_5 REAL,
  ma_20 REAL,
  ma_60 REAL,
  rsi REAL,
  macd REAL,
  bb_upper REAL,
  bb_middle REAL,
  bb_lower REAL,
  price_change_1m REAL,
  relative_strength_52w REAL,
  ma20_above_ma60_days INTEGER,
  PRIMARY KEY (stock_no, date)
);

CREATE INDEX IF NOT EXISTS idx_momentum_metrics_date ON momentum_metrics(date);
