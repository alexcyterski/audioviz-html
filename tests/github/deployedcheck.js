// End-to-end check of the DEPLOYED GitHub Pages sites.
// Usage: LD_LIBRARY_PATH=<armlibs> node github/deployedcheck.js
const { chromium } = require('playwright');
const config = require('../config');

const SITE = config.dsv4fDeployed;

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
           '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  const page = await browser.newPage();
  const errors = new Set();
  page.on('pageerror', (e) => errors.add('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.add('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.add('requestfailed: ' + r.url()));

  // asset probes
  for (const p of ['css/style.css', 'js/main.js', 'js/visualizers.js']) {
    const res = await page.request.get(SITE + p);
    console.log(p, '->', res.status());
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(SITE + '?autoplay=1&track=neon', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);

  const stats = await page.evaluate(() => {
    const c = document.getElementById('viz');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let lit = 0, total = 0;
    for (let i = 0; i < d.length; i += 400) {
      if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
      total++;
    }
    return {
      litPct: Math.round((lit / total) * 100),
      status: document.getElementById('status').textContent.trim().replace(/\s+/g, ' '),
      title: document.title,
    };
  });
  console.log('canvas lit:', stats.litPct + '%', '| status:', JSON.stringify(stats.status), '| title:', stats.title);
  await page.screenshot({ path: require('path').join(__dirname, 'shots', 'deployed-mobile.png') });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(SITE + '?mode=nebula&autoplay=1&track=grid&theme=aurora', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
  await page.screenshot({ path: require('path').join(__dirname, 'shots', 'deployed-desktop.png') });

  console.log('errors:', errors.size ? [...errors] : 'NONE');
  await browser.close();
})();
