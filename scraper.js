const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

let browserInstance = null;

async function getBrowser() {
  if (!browserInstance) {
    console.log('Launching new browser instance');
    browserInstance = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ],
      timeout: 7200000 // 2 hours
    });
  }
  return browserInstance;
}

const scrape1337x = async (query) => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setDefaultNavigationTimeout(7200000); // 2 hours
    console.log(`Navigating to search: ${query}`);
    
    await page.goto(`https://1337x.to/search/${encodeURIComponent(query)}/1/`, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('Waiting for results...');
    await page.waitForSelector('table.table-list tbody tr', { timeout: 15000 });

    const results = await page.$$eval('table.table-list tbody tr', (rows) => {
      return rows.map(row => ({
        title: row.querySelector('td.name a:nth-child(2)')?.textContent.trim(),
        size: row.querySelector('td.size')?.textContent.trim(),
        seeders: parseInt(row.querySelector('td.seeds')?.textContent) || 0,
        leechers: parseInt(row.querySelector('td.leeches')?.textContent) || 0,
        detailUrl: row.querySelector('td.name a:nth-child(2)')?.href
      })).filter(t => t.detailUrl);
    });

    console.log(`Found ${results.length} results, processing...`);
    
    for (const result of results) {
      const detailPage = await browser.newPage();
      try {
        await detailPage.setDefaultNavigationTimeout(7200000); // 2 hours
        await detailPage.goto(result.detailUrl, { waitUntil: 'networkidle2' });
        await detailPage.waitForSelector('a[href^="magnet:"]', { timeout: 10000 });
        result.magnet = await detailPage.$eval('a[href^="magnet:"]', a => a.href);
        console.log(`Got magnet link for: ${result.title}`);
      } finally {
        await detailPage.close();
      }
    }

    return results.filter(r => r.magnet);
  } catch (error) {
    console.error('Scraping error:', error);
    throw error;
  } finally {
    console.log('Scraping completed, keeping browser open');
  }
};

module.exports = { scrape1337x };
