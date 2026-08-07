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
  page.on('console', (m) => { if (m.type() === 'error') console.log('CONSERR', m.text()); });
  await page.goto('http://localhost:8901/?mode=bloom&palette=mono&autoplay=1&sheet=hidden');
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const st = window.__app.getStage();
    const app = window.__app.state;
    // Re-render one bloom frame manually with a spy to see computed values.
    const v = {
      bands: K3.engine.bands, energy: K3.engine.energy, bass: K3.engine.bass,
      kick: K3.engine.kick, dt: 0.016, t: performance.now() / 1000,
    };
    const vals = [];
    for (let i = 0; i < 8; i++) vals.push(+v.bands[i].toFixed(3));
    return {
      stage: st, mode: app.mode, energy: +v.energy.toFixed(3), bass: +v.bass.toFixed(3),
      bands0: vals,
      ringsSetting: app.modeSettings.bloom,
      canvas: { w: document.getElementById('viz').width, h: document.getElementById('viz').height },
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
