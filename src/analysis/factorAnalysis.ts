export function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0 || y.length !== n) return 0;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - meanX;
    const dy = y[i]! - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }
  if (denomX === 0 || denomY === 0) return 0;
  return num / Math.sqrt(denomX * denomY);
}

export interface FactorData {
  date: string;
  values: Record<string, number>;
  returns: Record<string, number>;
}

export function calcInformationCoefficient(data: FactorData[]): number {
  const icValues: number[] = [];
  for (const d of data) {
    const stocks = Object.keys(d.values);
    const factors = stocks.map(s => d.values[s]!);
    const rets = stocks.map(s => d.returns[s] ?? 0);
    icValues.push(pearsonCorrelation(factors, rets));
  }
  return icValues.reduce((a, b) => a + b, 0) / icValues.length;
}

export function calcFactorDecay(values: Record<string, number[]> , lag: number): Record<string, number> {
  const res: Record<string, number> = {};
  for (const [stock, arr] of Object.entries(values)) {
    if (arr.length <= lag) continue;
    const x = arr.slice(0, arr.length - lag);
    const y = arr.slice(lag);
    res[stock] = pearsonCorrelation(x, y);
  }
  return res;
}

export function calcFactorCorrelation(matrix: Record<string, number[]>): Record<string, Record<string, number>> {
  const keys = Object.keys(matrix);
  const result: Record<string, Record<string, number>> = {};
  for (let i = 0; i < keys.length; i++) {
    const a = keys[i]!;
    result[a] = {};
    for (let j = i + 1; j < keys.length; j++) {
      const b = keys[j]!;
      const corr = pearsonCorrelation(matrix[a]!, matrix[b]!);
      result[a][b] = corr;
      if (!result[b]) result[b] = {};
      result[b][a] = corr;
    }
  }
  return result;
}
