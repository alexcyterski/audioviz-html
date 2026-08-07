const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('https://github.com/alexcyterski/waveform-DSV4F/actions', {
    waitUntil: 'networkidle',
    timeout: 90000,
  });
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    // run rows are links to /actions/runs/<id>
    const links = [...document.querySelectorAll('a[href*="/actions/runs/"]')].slice(0, 8);
    return links.map((a) => {
      const row = a.closest('li, div');
      return {
        text: a.textContent.trim().replace(/\s+/g, ' ').slice(0, 110),
        href: a.href,
        status: row ? row.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : '',
      };
    });
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
