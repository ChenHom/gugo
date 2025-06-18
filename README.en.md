# 🇹🇼 Taiwan High-Potential Stock Screener

A comprehensive TypeScript tool that ranks Taiwan-listed equities by analyzing multiple fundamental factors including valuation, growth, quality, fund flow, and momentum.

## 🎯 Features

- **Multi-Factor Analysis**: Combines 5 key investment factors with customizable weights
- **Real-time Data**: Fetches latest data from FinMind API with fallback to TWSE OpenAPI
- **Smart Caching**: Local caching with automatic expiration and cleanup
- **Data Quality**: Built-in data cleaning and validation
- **CLI Interface**: Easy-to-use command-line tools
- **Comprehensive Testing**: 90%+ test coverage with Vitest
- **TypeScript**: Fully typed with strict type checking

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Basic Usage

```bash
# Fetch all data
npm run fetch-all

# Get top-ranked stocks
npm run rank

# Analyze specific stock
npm run explain 2330

# Fetch specific data types
npm run fetch-valuation
npm run fetch-growth
```

## 📊 Scoring System

The composite score combines 5 factors:

```
Total Score = 40% Valuation + 25% Growth + 15% Quality + 10% Fund-flow + 10% Momentum
```

### Factor Details

| Factor    | Weight | Metrics                    | Data Source                |
|-----------|--------|----------------------------|----------------------------|
| Valuation | 40%    | P/E, P/B, Dividend Yield  | FinMind TaiwanStockPER |
| Growth    | 25%    | Revenue YoY/MoM, EPS QoQ  | FinMind TaiwanStockMonthRevenue/FinancialStatements |
| Quality   | 15%    | ROE, Margins              | FinMind TaiwanStockBalanceSheet |
| Fund-flow | 10%    | Foreign/Trust Net Buying  | FinMind InstitutionalInvestorsBuySell |
| Momentum  | 10%    | Price trends, MA signals  | FinMind TaiwanStockPrice |

## 💻 CLI Commands

### Data Fetching

```bash
# Fetch all data types
npm run fetch-all

# Fetch valuation data for specific date
npm run fetch-valuation -- --date 2025-06-17

# Fetch growth data for specific stocks
npm run fetch-growth -- --stocks 2330,2454 --type revenue

# Skip cache and fetch fresh data
npm run fetch-valuation -- --no-cache
```

### Stock Analysis

```bash
# Rank all stocks (default: min score 70, limit 30)
npm run rank

# Custom ranking criteria
npm run rank -- --minScore 80 --limit 10

# Export to different formats
npm run rank -- --export json > results.json
npm run rank -- --export csv > results.csv

# Use custom factor weights (valuation,growth,quality,fund,momentum)
npm run rank -- --weights "50,20,15,10,5"

# Analyze specific stocks only
npm run rank -- --stocks 2330,2454,0050
```

### Individual Stock Analysis

```bash
# Detailed analysis of a specific stock
npm run explain 2330
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- dataCleaner.test.ts
```

## 🔧 Development

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Building

```bash
npm run build
```

## 📁 Project Structure

```
src/
├── cli/                 # Command-line interfaces
├── constants/           # Configuration constants
├── fetchers/           # Data fetching modules
├── services/           # Core business logic
├── types/              # TypeScript type definitions
└── utils/              # Utility functions

test/                   # Test files
migrations/             # Database migrations
docs/                   # Documentation
```

## 🛠️ Technical Stack

- **TypeScript 5** + **Node.js 18**
- **SQLite** with better-sqlite3
- **Vitest** for testing
- **ESLint** for code quality
- **FinMind API** and **TWSE OpenAPI** for data sources

## 📜 License

MIT License - see LICENSE file for details.
