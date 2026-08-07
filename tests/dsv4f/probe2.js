const { chromium } = require('playwright');
const config = require('../config');
(async () => {
  const browser = await chromium.launch({ headless: true, args: config.launchArgs });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${config.dsv4f.baseUrl}/?autoplay=1&track=neon`, { waitUntil: 'networkidle' });
  await page.click('.mode-tile:nth-child(2)');
  const info = await page.evaluate(() => {
    const swatch = document.querySelector('.swatch');
    const sheet = document.getElementById('sheet');
    const sr = sheet.getBoundingClientRect();
    const wr = swatch.getBoundingClientRect();
    return {
      sheetState: sheet.dataset.sheet,
      sheetRect: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), h: Math.round(sr.height) },
      swatchRect: { top: Math.round(wr.top), bottom: Math.round(wr.bottom) },
      swatchVisible: !!(wr.width && wr.height),
      bodyScrollTop: document.getElementById('sheet-body').scrollTop,
      bodyScrollH: document.getElementById('sheet-body').scrollHeight,
      bodyClientH: document.getElementById('sheet-body').clientHeight,
    };
  });
  console.log(JSON.stringify(info, null, 1));
  try {
    await page.click('.swatch:nth-child(1)', { timeout: 3000 });
    console.log('swatch click: OK');
  } catch (e) {
    console.log('swatch click: FAILED —', e.message.split('\n')[0]);
  }
  await browser.close();
})();
