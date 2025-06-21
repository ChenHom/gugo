export interface Holding {
  stockNo: string;
  weight: number;
}

export type VolumeMap = Record<string, number>; // average daily trading volume

export function adjustForAdtv(
  holdings: Holding[],
  volumes: VolumeMap
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const h of holdings) {
    const vol = volumes[h.stockNo] ?? 0;
    if (vol < 10_000_000) {
      result[h.stockNo] = 0;
      continue;
    }
    const cap = vol * 0.1;
    result[h.stockNo] = h.weight > cap ? cap : h.weight;
  }
  return result;
}
