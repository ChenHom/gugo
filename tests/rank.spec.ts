import { describe, it, expect, beforeEach, vi } from 'vitest';
import { run } from '../src/cli/rank.js';
import * as db from '../src/db.js';
import * as se from '../src/services/scoringEngine.js';

vi.mock('../src/db.js', () => ({ query: vi.fn() }));
vi.mock('../src/services/scoringEngine.js', () => ({ calcScore: vi.fn() }));

const query = db.query as unknown as ReturnType<typeof vi.fn>;
const calcScore = se.calcScore as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  query.mockReset();
  calcScore.mockReset();
});

describe('rank CLI', () => {
  it('limits output', async () => {
    query.mockReturnValue([{ stock_no: '1' }, { stock_no: '2' }]);
    calcScore.mockResolvedValue({ total: 10, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--limit', '1']);
    expect(calcScore).toHaveBeenCalledTimes(2);
    expect(table.mock.calls[0][0]).toHaveLength(1);
    table.mockRestore();
  });

  it('filters by minScore', async () => {
    query.mockReturnValue([{ stock_no: '1' }, { stock_no: '2' }]);
    calcScore.mockResolvedValueOnce({ total: 5, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    calcScore.mockResolvedValueOnce({ total: 50, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--minScore', '10', '--limit', '5']);
    expect(table.mock.calls[0][0]).toHaveLength(1);
    table.mockRestore();
  });

  it('sorts by total desc', async () => {
    query.mockReturnValue([{ stock_no: '1' }, { stock_no: '2' }]);
    calcScore
      .mockResolvedValueOnce({ total: 40, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] })
      .mockResolvedValueOnce({ total: 80, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--limit', '2']);
    const rows = table.mock.calls[0][0];
    expect(rows[0].total >= rows[1].total).toBe(true);
    table.mockRestore();
  });

  it('handles offline flag', async () => {
    query.mockReturnValue([{ stock_no: '1' }]);
    calcScore.mockResolvedValue({ total: 20, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--offline']);
    expect(table).toHaveBeenCalled();
    table.mockRestore();
  });

  it('passes custom weights', async () => {
    query.mockReturnValue([{ stock_no: '1' }]);
    calcScore.mockResolvedValue({ total: 20, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--weights', '50,20,10,10,10']);
    expect(calcScore.mock.calls[0][1]).toMatchObject({ weights: { valuation: 50 }});
    table.mockRestore();
  });

  it('uses percentile method', async () => {
    query.mockReturnValue([{ stock_no: '1' }]);
    calcScore.mockResolvedValue({ total: 20, valuation: 10, growth: 10, quality: 10, chips: 10, momentum: 10, missing: [] });
    const table = vi.spyOn(console, 'table').mockImplementation(() => {});
    await run(['--method', 'percentile']);
    expect(calcScore.mock.calls[0][1]).toMatchObject({ method: 'percentile' });
    table.mockRestore();
  });
});
