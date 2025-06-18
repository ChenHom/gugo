-- 新增 Bollinger Band 欄位至 technical_indicators 表
ALTER TABLE technical_indicators ADD COLUMN bb_upper REAL;
ALTER TABLE technical_indicators ADD COLUMN bb_middle REAL;
ALTER TABLE technical_indicators ADD COLUMN bb_lower REAL;
