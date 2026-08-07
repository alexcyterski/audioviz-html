const { chromium } = require('playwright');
const config = require('../config');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: config.armLibPath },
    args: config.launchArgs,
  });
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  page.on('pageerror', (e) => console.log('PAGEERR', e.message));
  await page.goto('http://localhost:8901/?mode=bloom&palette=mono&autoplay=1&sheet=hidden');
  await page.waitForTimeout(3500);

  // Freeze the main loop by hiding the document? No — instead instrument:
  const out = await page.evaluate(() => {
    const c = document.getElementById('viz');
    const g = c.getContext('2d');
    const before = g.getImageData(150, 300, 90, 200).data;
    let litBefore = 0;
    for (let i = 0; i < before.length; i += 4) {
      if (before[i] > 24 || before[i + 1] > 24 || before[i + 2] > 30) litBefore++;
    }
    return { litBefore, total: before.length / 4 };
  });
  console.log('center-region lit:', out.litBefore, '/', out.total);
  await page.screenshot({ path: '/tmp/bloom-debug.png', clip: { x: 60, y: 200, width: 270, height: 400 } });
  await browser.close();
})();
