export function calcMetrics(equity: number[]): { annualReturn: number; sharpe: number; maxDrawdown: number } {
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push(equity[i]! / equity[i - 1]! - 1);
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  const annualReturn = Math.pow(1 + mean, 252) - 1;
  const sharpe = std === 0 ? 0 : (mean / std) * Math.sqrt(252);

  let peak = equity[0]!;
  let maxDrawdown = 0;
  for (const val of equity) {
    if (val > peak) peak = val;
    const draw = val / peak - 1;
    if (draw < maxDrawdown) maxDrawdown = draw;
  }
  return { annualReturn, sharpe, maxDrawdown };
}
