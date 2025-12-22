# Taiwan Stock Screener - AI Coding Agent Instructions

## Project Overview
This is a **TypeScript 5 / Node 22 ESM** quantitative finance CLI that screens Taiwan-listed equities using multi-factor analysis (Valuation 40%, Growth 25%, Quality 15%, Fund-flow 10%, Momentum 10%). Data is fetched from FinMind API and TWSE OpenAPI, stored in SQLite (better-sqlite3), with robust caching and progress tracking.

## Critical ESM Requirements
**ALWAYS use ES modules syntax - this is non-negotiable:**
- Use `import` statements, NEVER `require()`
- All local imports MUST include `.js` extension: `import { utils } from './utils.js'`
- Use `import.meta.url` instead of `__dirname`
- Project is configured with `"type": "module"` in package.json

## Architecture & Data Flow

### Five-Factor Scoring System
Each stock gets scored 0-100 per factor via z-score normalization:
```typescript
// See src/services/scoringEngine.ts
TotalScore = 40% * valuation + 25% * growth + 15% * quality + 10% * chips + 10% * momentum
```

### Quality Factor Calculation
Calculated in `QualityFetcher` using financial statements:
- **ROE** = (Net Income / Total Equity) * 100
- **Gross Margin** = (Gross Profit / Revenue) * 100
- **Operating Margin** = (Operating Income / Revenue) * 100
- **Net Margin** = (Net Income / Revenue) * 100
- **Debt Ratio** = (Total Liabilities / Total Assets) * 100
- **Current Ratio** = Current Assets / Current Liabilities

### Core Components
1. **Fetchers** (`src/fetchers/*.ts`) - Each factor has a dedicated fetcher class that:
   - Calls FinMind/TWSE APIs via `src/adapters/finmind.ts` or `src/utils/twseApiClient.ts`
   - Uses `CacheManager` for 24h TTL caching
   - Handles quota limits with `QuotaExceededError` (FinMind limit: **600 requests per hour**)
   - Writes to SQLite via `better-sqlite3` (Native SQLite, NOT sql.js)
   - Example: `GrowthFetcher` fetches monthly revenue (YoY/MoM) and EPS from FinMind

2. **Database** (`data/fundamentals.db`) - SQLite with 14+ tables:
   - Core tables: `price_daily`, `valuation`, `growth`, `quality`, `chips`, `momentum_metrics`
   - Metadata: `stock_list`, `stock_metadata` (industry, market type)
   - Migrations in `migrations/*.sql` - tracked via `migration_history` table
   - Access via `DatabaseManager` class, not raw `db.ts` query function

3. **CLI Commands** (`src/cli/*.ts`) - Each command is a standalone script using `yargs`:
   - Data fetch: `fetch-all`, `fetch-valuation`, `fetch-growth`, etc.
   - Analysis: `rank`, `explain`, `visualize`
   - Backtesting: `backtest`, `walk-forward`, `optimize`
   - Run via `npm run <command>` (see `docs/cli_usage.md` for all commands)

4. **Progress Tracking** - `fetch-all` uses `ProgressTracker` to save state in `data/progress_fetch-all.json`:
   - Enables resume after FinMind quota exhaustion
   - Tracks per-stock, per-fetcher completion status

## Key Conventions

### Error Handling Pattern
```typescript
import { QuotaExceededError } from '../utils/errors.js';
import { ErrorHandler } from '../utils/errorHandler.js';

await ErrorHandler.initialize(); // In CLI entry points
try {
  await finmindClient.fetch(...);
} catch (err) {
  if (err instanceof QuotaExceededError) {
    // Save progress and exit gracefully
  }
  throw err;
}
```

### Database Operations
**Always use `DatabaseManager`** for complex queries, not the legacy `db.ts`:
```typescript
import { DatabaseManager } from '../utils/databaseManager.js';
const dbManager = new DatabaseManager();
await dbManager.initialize();
const data = await dbManager.getValuationData();
```

### Caching Pattern
```typescript
import { CacheManager } from '../utils/cacheManager.js';
const cache = new CacheManager('finmind'); // Dataset-specific cache dir
const cached = await cache.get(cacheKey);
if (cached) return cached;
// ... fetch from API ...
await cache.set(cacheKey, data, 24 * 60 * 60 * 1000); // 24h TTL
```

### Naming Conventions
- **Classes/Interfaces**: PascalCase (`GrowthFetcher`, `StockScore`)
- **Variables/Functions**: camelCase (`fetchGrowthData`, `calcScore`)
- **Constants**: ALL_CAPS (`DEFAULT_WEIGHTS`, `FINMIND_BASE_URL`)
- **DB columns**: snake_case (`stock_no`, `dividend_yield`)

## Testing Requirements

### Test Organization (see `.github/instructions/test-organization.instructions.md`)
```
tests/
├── unit/         # Mock all external dependencies (DB, API)
├── integration/  # Real DB, mocked APIs
└── e2e/          # Full flow with real/stubbed data
```

### Critical Rules
- All test files use `.test.ts` suffix (never `.spec.ts`)
- Must mock FinMind/TWSE APIs in tests - check `tests/setup.ts`
- Coverage target: ≥90% for core services (backtest, portfolioBuilder)
- Run tests: `npm test`, coverage: `npm run test:coverage`

## Development Workflow

### Common Tasks
```bash
# Build
npm run build           # TypeScript compilation to dist/

# Fetch data (with resume support)
npm run update-stock-list               # Update stock list from TWSE
npm run fetch-all                       # All factors, auto-resume on quota limit
npm run fetch-all -- --stocks 2330,2317 # Specific stocks only

# Analysis
npm run rank -- --minScore 70 --limit 20
npm run explain -- --stock 2330
npm run visualize -- --stock 2330 --type factor-radar

# Backtesting
npm run backtest -- --start 2023-01-01 --end 2024-01-01 --top 10
npm run walk-forward -- --start 2020-01-01 --folds 4
npm run optimize -- --start 2023-01-01 --tops 5,10,20 --rebalance 21,42,63
```

### Debugging Tips
1. **FinMind Quota Issues**: Check `data/progress_fetch-all.json` for last successful fetch
2. **DB Schema Errors**: Verify migration history: `SELECT * FROM migration_history`
3. **Cache Staleness**: Delete `.cache/` or specific dataset subdirs
4. **Missing Data**: Run `npm run list-stocks -- --show-scores` to see coverage

## External Dependencies

### FinMind API (`src/adapters/finmind.ts`)
- Requires `FINMIND_TOKEN` in `.env` (optional but recommended to avoid rate limits)
- **Quota Limit**: 600 requests per hour (enforced via `QuotaExceededError`)
- Datasets: `TaiwanStockMonthRevenue`, `TaiwanStockPrice`, `TaiwanStockBalanceSheet`, etc.
- Error handling: Returns `{ status, data, msg }` - check `status !== 200`

### TWSE OpenAPI (`src/utils/twseApiClient.ts`)
- No auth required, but use `TWSE_USER_AGENT` for politeness
- Endpoints: `/v1/opendata/t187ap03_L` (PER/PBR), `/v1/exchangeReport/BWIBBU_d`, etc.
- Fallback when FinMind quotas exhausted

## Documentation Sources
- **CLI Usage**: `docs/cli_usage.md` (ALL npm run commands documented here, NOT in README)
- **DB Schema**: `docs/DATABASE_SCHEMA.md` (14 tables with Chinese descriptions)
- **Project Status**: `PROJECT_STATUS.md` (FinMind integration status, technical debt)
- **Base Spec**: `.github/instructions/taiwan-high‑potential-stock-screener.instructions.md`

## Common Pitfalls
1. **Don't use `require()`** - This is an ESM project, imports must use `.js` extension
2. **Don't bypass `DatabaseManager`** - The old `db.ts` query function lacks migration awareness
3. **Don't ignore quota errors** - Always catch `QuotaExceededError` and save progress
4. **Don't create `.spec.ts` files** - Use `.test.ts` per test organization rules
5. **Don't document CLI in README** - All command docs go in `docs/cli_usage.md`

## File References for Common Tasks
- Add new factor: Start from `src/fetchers/growthFetcher.ts` as template
- Modify scoring: See `src/services/scoringEngine.ts` (z-score normalization logic)
- Add CLI command: Copy `src/cli/rank.ts` structure, use yargs + ora spinner
- Database migration: Create `migrations/XXX_description.sql`, add to `DatabaseManager.runMigrations()`
