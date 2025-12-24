<!--
Sync Impact Report:
- Version change: 1.1.0 -> 1.2.0
- List of modified principles:
  - Principle II: Added explicit Quality Factor formulas (ROE, Gross Margin, etc.).
  - Principle IV: Mandated use of `DatabaseManager` and `ProgressTracker`.
- Added sections: Common Pitfalls (ESM, DB, Quota, Tests, Docs).
- Templates requiring updates:
  - .specify/templates/plan-template.md (✅ updated with DatabaseManager gate)
  - .specify/templates/tasks-template.md (✅ updated with DatabaseManager checklist)
- Follow-up TODOs: None.
-->

# Taiwan Stock Screener Constitution

## Core Principles

### I. ESM-First Architecture
All code must use ES modules (ESM). `import` statements are mandatory; `require()` is forbidden. Local imports must include the `.js` extension. Use `import.meta.url` for path resolution. This ensures compatibility with Node 22 and modern TypeScript standards.

### II. Multi-Factor Scoring Discipline
Scoring follows a strict weight distribution:
- **Valuation (40%)**: PER, PBR, Dividend Yield.
- **Growth (25%)**: Monthly Revenue YoY & MoM, EPS QoQ.
- **Quality (15%)**: ROE, Gross Margin, Operating Margin, Net Margin, Debt Ratio, Current Ratio.
- **Fund-flow (10%)**: Foreign/Institutional/Dealer net buy (5d).
- **Momentum (10%)**: 52-week RS%, MA20 > MA60 running days.

**Quality Factor Formulas (Non-negotiable)**:
- **ROE** = (Net Income / Total Equity) * 100
- **Gross Margin** = (Gross Profit / Revenue) * 100
- **Operating Margin** = (Operating Income / Revenue) * 100
- **Net Margin** = (Net Income / Revenue) * 100
- **Debt Ratio** = (Total Liabilities / Total Assets) * 100
- **Current Ratio** = Current Assets / Current Liabilities

Each factor is normalized using z-scores or percentiles (0-100). Missing metrics must be explicitly tracked and reported in the `missing` field of the score result.

### III. CLI-First Interface & UX
All core functionality must be exposed via CLI commands using `yargs`.
- **Signal Handling**: Use `setupCliSignalHandler` for graceful exits (SIGINT/SIGTERM).
- **Batch Processing**: Use `processItems` for robust batch operations with retry and error skipping.
- **Feedback**: Provide visual feedback via `ora` spinners and clear success/failure statistics.
- **Documentation**: Command documentation resides exclusively in `docs/cli_usage.md`.

### IV. Data Integrity, Caching & Fallbacks
- **Caching**: External API calls must be cached for 24 hours using `CacheManager`.
- **Quota Management**: Detect FinMind `402 Payment Required` errors (limit: 600 req/hr) and provide friendly user guidance.
- **Fallback Mechanism**: Use TWSE OpenAPI as a fallback for FinMind when quotas are exhausted.
- **Database Operations**: **Always use `DatabaseManager`** for complex queries and migrations. Avoid the legacy `db.ts`.
- **Progress Tracking**: Long-running operations must use `ProgressTracker` to support resume via `data/progress_fetch-all.json`.

### V. Testing & Coverage Standards
Vitest is the mandatory testing framework. Core services (`backtest`, `portfolioBuilder`, `scoringEngine`) must maintain ≥90% coverage. Tests must be organized into unit, integration, and e2e directories with `.test.ts` suffixes. Mocking external APIs is mandatory in unit tests.

## Naming Conventions
- **PascalCase**: Component names, interfaces, and type aliases.
- **camelCase**: Variables, functions, and methods.
- **ALL_CAPS**: Constants.
- **snake_case**: Database columns.

## Error Handling Patterns
- Use `try/catch` blocks for all async operations.
- Always log errors with contextual information.
- Use `QuotaExceededError` for API limit handling.
- Single item failures in batch processing should not crash the entire process.

## Technical Constraints
- **Runtime**: Node.js 22+ (ESM).
- **Database**: SQLite via `better-sqlite3` (Native).
- **HTTP**: `node-fetch` (v3 ESM) with retries and back-off.
- **Linting**: ESLint + Prettier with `"strict": true`.

### Common Pitfalls (Forbidden)
1. **Don't use `require()`**: This is an ESM project, imports must use `.js` extension.
2. **Don't bypass `DatabaseManager`**: The old `db.ts` lacks migration awareness.
3. **Don't ignore quota errors**: Always catch `QuotaExceededError` and save progress.
4. **Don't create `.spec.ts` files**: Use `.test.ts` per test organization rules.
5. **Don't document CLI in README**: All command docs go in `docs/cli_usage.md`.

## Governance
- The Constitution is the source of truth for project standards and supersedes all other practices.
- Amendments require a version bump (Semantic Versioning) and a Sync Impact Report.
- All implementation plans and tasks must be validated against these principles.
- Compliance is reviewed during code reviews and automated via linting/testing gates.

**Version**: 1.2.0 | **Ratified**: 2025-12-22 | **Last Amended**: 2025-12-25
