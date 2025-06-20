export function meanVarianceOptimize(expected: number[], cov: number[][]): number[] {
  const n = expected.length;
  const inv: number[][] = invertMatrix(cov);
  const w: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      w[i] += inv[i][j] * expected[j]!;
    }
  }
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map(x => x / sum);
}

export function riskParity(cov: number[][]): number[] {
  const n = cov.length;
  const vols = cov.map((row, i) => Math.sqrt(row[i]!));
  const invVol = vols.map(v => (v === 0 ? 0 : 1 / v));
  const sum = invVol.reduce((a, b) => a + b, 0);
  return invVol.map(v => v / sum);
}

function invertMatrix(a: number[][]): number[][] {
  const n = a.length;
  const id = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))
  );
  const m = a.map(row => row.slice());
  for (let i = 0; i < n; i++) {
    let pivot = m[i][i];
    if (pivot === 0) {
      for (let j = i + 1; j < n; j++) {
        if (m[j][i] !== 0) {
          [m[i], m[j]] = [m[j], m[i]];
          [id[i], id[j]] = [id[j], id[i]];
          pivot = m[i][i];
          break;
        }
      }
    }
    if (pivot === 0) throw new Error('Singular matrix');
    for (let j = 0; j < n; j++) {
      m[i][j] /= pivot;
      id[i][j] /= pivot;
    }
    for (let k = 0; k < n; k++) {
      if (k === i) continue;
      const factor = m[k][i];
      for (let j = 0; j < n; j++) {
        m[k][j] -= factor * m[i][j];
        id[k][j] -= factor * id[i][j];
      }
    }
  }
  return id;
}
