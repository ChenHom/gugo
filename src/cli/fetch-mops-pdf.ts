
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { downloadMopsPdf } from '../fetchers/mopsFetcher.js';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .command(
      'fetch-mops-pdf <stockNo> <year>',
      'Download a consolidated financial report PDF from MOPS',
      (yargs) => {
        return yargs
          .positional('stockNo', {
            describe: 'Stock number (e.g., 2330)',
            type: 'string',
          })
          .positional('year', {
            describe: 'Year in Taiwan calendar format (e.g., 112 for 2023)',
            type: 'string',
          });
      },
      async (argv) => {
        if (argv.stockNo && argv.year) {
          console.log(`Attempting to download PDF for stock ${argv.stockNo}, year ${argv.year}...`);
          const filePath = await downloadMopsPdf(argv.stockNo, argv.year);
          if (filePath) {
            console.log(`Download complete. File saved at: ${filePath}`);
          } else {
            console.error('Download failed. Please check the logs for details.');
          }
        }
      }
    )
    .demandCommand(1, 'You need to specify a command.')
    .help()
    .argv;
}

main().catch(console.error);
