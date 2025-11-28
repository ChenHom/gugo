
import puppeteer, { Browser } from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const DOWNLOAD_DIR = path.resolve(process.cwd(), 'downloads');

/**
 * Downloads the consolidated financial report (AI1.pdf) from MOPS for a given stock and year.
 *
 * @param stockNo The stock number (e.g., '2330').
 * @param year The year in Taiwan calendar format (e.g., '112' for 2023).
 * @returns The path to the downloaded PDF file, or null if not found.
 */
export async function downloadMopsPdf(stockNo: string, year: string): Promise<string | null> {
  let browser: Browser | null = null;
  try {
    // Ensure download directory exists
    await fs.mkdir(DOWNLOAD_DIR, { recursive: true });

    // 1. Launch the browser
    browser = await puppeteer.launch({
      headless: false, // Use true for automation, false for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    // 2. Open a new page and navigate to the target URL
    const page = await browser.newPage();
    await page.goto('https://mops.twse.com.tw/mops/web/t57sb01', {
      waitUntil: 'networkidle2',
    });

    // 3. Fill in the form
    // Note: These selectors might change if MOPS updates their website.
    await page.waitForSelector('#co_id', { visible: true });
    await page.type('#co_id', stockNo);

    await page.waitForSelector('#year', { visible: true });
    await page.type('#year', year);

    // 4. Click the search button and wait for navigation
    const searchButtonSelector = 'input[type="button"][value=" 查詢 "]';
    await page.waitForSelector(searchButtonSelector, { visible: true });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
      page.click(searchButtonSelector),
    ]);

    // 5. Find the link to the consolidated report (AI1.pdf)
    const reportLinkSelector = 'a[href*="_AI1.pdf"]';
    const reportElement = await page.$(reportLinkSelector);

    if (!reportElement) {
      console.log(`Consolidated report (AI1.pdf) not found for ${stockNo} in year ${year}.`);
      return null;
    }

    const reportUrl = await page.evaluate(el => el.href, reportElement);

    // 6. Download the PDF
    const pdfPage = await browser.newPage();
    const response = await pdfPage.goto(reportUrl, { waitUntil: 'networkidle2' });
    const pdfBuffer = await response.buffer();

    // 7. Save the PDF to a file
    const fiscalYear = parseInt(year) + 1911;
    const fileName = `${fiscalYear}_${stockNo}_AI1.pdf`;
    const filePath = path.join(DOWNLOAD_DIR, fileName);
    await fs.writeFile(filePath, pdfBuffer);

    console.log(`Successfully downloaded PDF to: ${filePath}`);
    return filePath;

  } catch (error) {
    console.error(`Failed to download MOPS PDF for ${stockNo}:`, error);
    if (browser) {
      const page = (await browser.pages())[0];
      if (page) {
        await page.screenshot({ path: path.join(DOWNLOAD_DIR, 'mops-error.png') });
        console.log('Screenshot saved to downloads/mops-error.png');
      }
    }
    return null;
  } finally {
    // 8. Close the browser
    if (browser) {
      await browser.close();
    }
  }
}
