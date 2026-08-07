const { chromium } = require('playwright');
const config = require('../config');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`https://github.com/${config.githubRepo}/deployments`, {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.waitForTimeout(5000);
  const text = await page.evaluate(() => document.body.innerText);
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  console.log(lines.slice(0, 50).join('\n'));
  await browser.close();
})();
