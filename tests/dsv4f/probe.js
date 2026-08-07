const { chromium } = require('playwright');
const config = require('../config');
(async () => {
  const browser = await chromium.launch({ headless: true, args: config.launchArgs });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${config.dsv4f.baseUrl}/?autoplay=1&track=neon`, { waitUntil: 'networkidle' });
  const info = await page.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const tune = document.querySelector('.tune');
    const swatch = document.querySelector('.swatch');
    const body = document.getElementById('sheet-body');
    const cs = (el) => getComputedStyle(el).display;
    return {
      innerHeight: window.innerHeight,
      sheetState: sheet.dataset.sheet,
      bodyDisplay: cs(body),
      tuneDisplay: cs(tune),
      swatchDisplay: cs(swatch),
      swatchRect: swatch.getBoundingClientRect().toJSON(),
      maxHeight: getComputedStyle(sheet).maxHeight,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
