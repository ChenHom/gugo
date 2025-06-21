# 🇹🇼 Taiwan High-Potential Stock Screener

A comprehensive TypeScript tool that ranks Taiwan-listed equities by analyzing multiple fundamental factors including valuation, growth, quality, fund flow, and momentum.

## 🎯 Features

- **Multi-Factor Analysis**: Combines 5 key investment factors with customizable weights
- **Real-time Data**: Fetches latest data from FinMind API with fallback to TWSE OpenAPI
- **Smart Caching**: Local caching with automatic expiration and cleanup
- **Liquidity Sizing**: Caps each position at 10% of average daily volume
- **Data Quality**: Built-in data cleaning and validation
- **CLI Interface**: Easy-to-use command-line tools
- **Comprehensive Testing**: 90%+ test coverage with Vitest
- **TypeScript**: Fully typed with strict type checking
- **Risk Metrics**: Estimates a 95% confidence interval for max drawdown via 1000 bootstrap samples

## 🚀 Quick Start

### Installation

```bash
npm install
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

All `npm run` command usage is documented in [docs/cli_usage.md](docs/cli_usage.md).

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
