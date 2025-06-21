export interface RankRow {
  date: string;
  stock: string;
  score: number;
  marketCap?: number;
}

export type WeightMap = Record<string, Record<string, number>>;

export interface PortfolioOptions {
  top: number;
  mode: 'equal' | 'cap';
}

export function buildPortfolios(
  ranks: RankRow[],
  opts: PortfolioOptions
): WeightMap {
  const byDate: Record<string, RankRow[]> = {};
  for (const r of ranks) {
    if (!byDate[r.date]) byDate[r.date] = [];
    byDate[r.date]!.push(r);
  }
  const weights: WeightMap = {};
  for (const [date, arr] of Object.entries(byDate)) {
    const sorted = [...arr].sort((a, b) => b.score - a.score).slice(0, opts.top);
    if (sorted.length === 0) continue;
    if (opts.mode === 'equal') {
      const w = 1 / sorted.length;
      weights[date] = Object.fromEntries(sorted.map(r => [r.stock, w]));
    } else {
      const sum = sorted.reduce((s, r) => s + (r.marketCap ?? 1), 0);
      weights[date] = Object.fromEntries(
        sorted.map(r => [r.stock, (r.marketCap ?? 1) / sum])
      );
    }
  }
  return weights;
}
