export interface VolumeBar {
  date: string;
  volume: number;
}

export type VolumeSeries = Record<string, VolumeBar[]>;

export function filterByLiquidity(
  volumes: VolumeSeries,
  lookback: number,
  minAvg: number
): string[] {
  const result: string[] = [];
  for (const [stock, series] of Object.entries(volumes)) {
    const recent = series.slice(-lookback);
    if (recent.length === 0) continue;
    const avg =
      recent.reduce((sum, v) => sum + (v.volume ?? 0), 0) / recent.length;
    if (avg >= minAvg) result.push(stock);
  }
  return result;
}
