const { chromium } = require('playwright');
const config = require('../config');
(async () => {
  const browser = await chromium.launch({ headless: true, args: config.launchArgs });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${config.dsv4f.baseUrl}/`, { waitUntil: 'networkidle' });
  const read = () => page.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const sr = sheet.getBoundingClientRect();
    const s = window.__waveform.getStage();
    return {
      state: sheet.dataset.sheet,
      sheetTop: Math.round(sr.top), sheetH: Math.round(sr.height),
      transform: getComputedStyle(sheet).transform,
      stage: { y: Math.round(s.y), h: Math.round(s.h), bottom: Math.round(s.y + s.h) },
      innerH: innerHeight,
    };
  });
  console.log('initial:', JSON.stringify(await read()));
  // drag the grip down 160px
  const gripBox = await (await page.$('#sheet-grip')).boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + 160, { steps: 10 });
  await page.mouse.up();
  console.log('immediately after drag:', JSON.stringify(await read()));
  await page.waitForTimeout(300);
  console.log('300ms later:', JSON.stringify(await read()));
  await browser.close();
})();
