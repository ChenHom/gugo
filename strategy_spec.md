# MA20/60 交叉 + 8% 停損 策略規格

## 1. 規則

1. **進場**：MA20 上穿 MA60 → 全倉買進
2. **出場**：收盤價跌破 MA60 → 全數賣出
3. **部位**：100 % 可用資金
4. **停損**：收盤價 < 進場價 × 0.92 → 強制賣出
5. **當日限頻**：同日最多 1 次交易

## 2. 驗證指標

| 指標 | 定義 | 目標 |
|------|------|------|
| 年化報酬率 | `(1 + 平均日報酬)^252 - 1` | ≥ 8 % |
| 夏普值 | `平均日報酬 / 日波動 × √252` | ≥ 1 |
| 最大回撤 | 最低 `(累積資產 / 歷史高點) - 1` | ≤ -30 % |

## 3. 數據與假設

* 標的：復華台灣科技優息(00929.TW)
* 期間：2023-01-01 ～ 2025-06-11
* 手續費：0.1425 %（含證交稅）
* 滑價：0.05 %
* 停損與出場以 **收盤價** 判斷

## 4. 驗證方式

1. Excel：手算第一筆交易驗證正確性
2. pandas：全回測計算指標
3. Backtrader：轉為 `Cerebro` Analyzer 交叉驗收
