import yargs, { Argv } from 'yargs';
import { StockListService } from './../services/stockListService.js';

export function addStockListCommands(yargs: Argv): Argv {
  return yargs
    .command(
      'update-stock-list',
      '更新股票清單',
      {},
      async () => {
        const service = new StockListService();
        try {
          await service.initialize();
          const count = await service.updateStockList();
          console.log(`✅ 成功更新 ${count} 支股票資料`);
        } catch (error) {
          console.error('❌ 更新股票清單失敗:', error);
          process.exit(1);
        } finally {
          service.close();
        }
      }
    )
    .command(
      'list-stocks',
      '顯示股票清單',
      (yargs: Argv) => {
        return yargs
          .option('market', {
            alias: 'm',
            type: 'string',
            description: '依市場篩選 (上市/上櫃/興櫃)',
          })
          .option('industry', {
            alias: 'i',
            type: 'string',
            description: '依產業篩選',
          })
          .option('limit', {
            alias: 'l',
            type: 'number',
            description: '限制顯示筆數',
            default: 50,
          })
          .option('stats', {
            alias: 's',
            type: 'boolean',
            description: '顯示統計資訊',
            default: false,
          });
      },
      async (argv: any) => {
        const service = new StockListService();
        try {
          await service.initialize();

          if (argv.stats) {
            const stats = await service.getStockListStats();
            console.log('\n📊 股票清單統計');
            console.log('='.repeat(50));
            console.log(`總計: ${stats.total} 支股票`);
            console.log(`最後更新: ${stats.lastUpdated || '未知'}`);
            console.log('\n按市場分類:');
            Object.entries(stats.byMarket).forEach(([market, count]) => {
              console.log(`  ${market}: ${count} 支`);
            });
          } else {
            const stocks = await service.getStocks({
              market: argv.market,
              industry: argv.industry,
              limit: argv.limit,
            });

            console.log('\n📋 股票清單');
            console.log('='.repeat(80));
            console.log('代碼\t名稱\t\t產業\t\t市場\t最後更新');
            console.log('-'.repeat(80));

            stocks.forEach((stock: any) => {
              console.log(
                `${stock.stockNo}\t${stock.name.padEnd(12)}\t${(stock.industry || '').padEnd(12)}\t${stock.market}\t${stock.updatedAt?.substring(0, 10) || ''}`
              );
            });

            console.log(`\n共 ${stocks.length} 支股票`);
          }
        } catch (error) {
          console.error('❌ 顯示股票清單失敗:', error);
          process.exit(1);
        } finally {
          service.close();
        }
      }
    );
}