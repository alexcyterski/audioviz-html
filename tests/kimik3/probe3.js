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
  page.on('console', (m) => console.log('[pg]', m.text()));
  await page.goto('http://localhost:8901/?mode=bloom&palette=mono&autoplay=1&sheet=hidden');
  await page.waitForTimeout(3000);
  const out = await page.evaluate(() => {
    // Monkey-patch strokeStyle setter tracing is messy; instead directly
    // compute what bloom's stroke SHOULD be for ring r=3 and draw one test
    // ring ourselves to confirm canvas is fine.
    const app = window.__app.state;
    const p = K3.PALETTES.find((x) => x.id === app.palette);
    const [c0, c1, c2] = p.colors;
    const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const lerp = (a, b, m) => a + (b - a) * m;
    const mixA = (h1, h2, m, alpha) => {
      const a = hexRgb(h1), b = hexRgb(h2);
      return `rgba(${Math.round(lerp(a[0], b[0], m))},${Math.round(lerp(a[1], b[1], m))},${Math.round(lerp(a[2], b[2], m))},${alpha})`;
    };
    const cA = `rgb(${hexRgb(c0).map((x, i) => Math.round(lerp(x, hexRgb(c1)[i], 0.6))).join(',')})`;
    const cB = `rgb(${hexRgb(c1).map((x, i) => Math.round(lerp(x, hexRgb(c2)[i], 0.6))).join(',')})`;
    const probe = mixA(cA, cB, 0.9, 0.5);

    const c = document.getElementById('viz');
    const g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); // physical pixels; dpr=1 headless
    g.strokeStyle = probe;
    g.lineWidth = 4;
    g.beginPath(); g.arc(195, 300, 120, 0, Math.PI * 2); g.stroke();
    const px = g.getImageData(195, 178, 1, 1).data; // top of ring
    return { probe, ringPixel: [px[0], px[1], px[2], px[3]] };
  });
  console.log(JSON.stringify(out));
  await browser.close();
})();
