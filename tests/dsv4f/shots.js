// Headless verification + screenshots for the Waveform DSV4F visualizer.
// Usage: LD_LIBRARY_PATH=<armlibs> node dsv4f/shots.js
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const BASE = config.dsv4f.baseUrl;
const SHOTS = path.join(config.shotsDir, 'dsv4f');
fs.mkdirSync(SHOTS, { recursive: true });

async function canvasStats(page) {
  return page.evaluate(() => {
    const c = document.getElementById('viz');
    const ctx = c.getContext('2d');
    const { width, height } = c;
    const d = ctx.getImageData(0, 0, width, height).data;
    let nonBg = 0, lit = 0, total = d.length / 4;
    for (let i = 0; i < d.length; i += 400) { // sample every 100th pixel
      const r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
      if (a > 0 && (r + g + b) > 30) lit++;
      nonBg++;
    }
    return { lit, total: nonBg, pct: Math.round((lit / nonBg) * 100) };
  });
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--disable-dev-shm-usage',
    ],
  });
  const page = await browser.newPage();
  const errors = new Set();
  page.on('console', (m) => { if (m.type() === 'error') errors.add('console: ' + m.text()); });
  page.on('pageerror', (e) => errors.add('pageerror: ' + e.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE + '/?track=neon', { waitUntil: 'networkidle' });
  // clicking is impossible headless-with-gestures; autoplay flag should let the
  // demo track start. Wait for real analyser energy.
  await page.waitForTimeout(1200);
  const idle = await canvasStats(page);
  console.log('idle page canvas lit %:', idle.pct, '%');
  console.log('status:', await page.textContent('#status'));

  // font availability check (the earlier blank buttons were a missing-fonts issue)
  const fonts = await page.evaluate(() => ({
    dejavu: document.fonts.check('14px "DejaVu Sans"'),
    symbola: document.fonts.check('20px Symbola'),
    emoji: document.fonts.check('20px "Noto Color Emoji"'),
  }));
  console.log('fonts available:', JSON.stringify(fonts));
  console.log('play button text:', JSON.stringify(await page.textContent('#btn-play')));

  // full-UI capture (idle state, all controls visible with text)
  await page.screenshot({ path: path.join(SHOTS, 'ui-idle.png') });

  const modes = ['spectrum', 'orbit', 'nebula', 'wave', 'pulse'];
  for (const mode of modes) {
    await page.goto(`${BASE}/?mode=${mode}&autoplay=1&track=neon`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(4500); // let the sequencer build up energy
    const s = await canvasStats(page);
    const status = await page.textContent('#status');
    await page.screenshot({ path: path.join(SHOTS, `${mode}-mobile.png`) });
    console.log(`${mode}: lit ${s.pct}% | status "${status}"`);
  }

  // desktop view, different track + theme
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/?mode=nebula&autoplay=1&track=grid&theme=aurora`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4500);
  const d = await canvasStats(page);
  await page.screenshot({ path: path.join(SHOTS, 'nebula-desktop.png') });
  console.log(`nebula-desktop: lit ${d.pct}% | status "${await page.textContent('#status')}"`);

  // mic path (fake device provides audio in headless)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/?mode=pulse&src=mic&theme=sunset`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);
  const m = await canvasStats(page);
  console.log(`mic-pulse: lit ${m.pct}% | status "${await page.textContent('#status')}"`);

  // interaction smoke test: switch mode + theme via clicks
  await page.goto(`${BASE}/?autoplay=1&track=lofi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  await page.click('button[data-mode="orbit"]');
  await page.click('.swatch[data-theme="ocean"]');
  await page.waitForTimeout(1200);
  console.log('after clicks, status:', await page.textContent('#status'));
  console.log('mirror switch checked:', await page.isChecked('#mirror'));
  console.log('active mode after clicks:', await page.$eval('.mode-tile.active', (el) => el.dataset.mode));

  // swipe gesture on the canvas: left → next mode (orbit → nebula)
  await page.goto(`${BASE}/?mode=orbit&autoplay=1&track=neon`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.mouse.move(300, 300);
  await page.mouse.down();
  await page.mouse.move(120, 300, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  console.log('mode after swipe left:', await page.$eval('.mode-tile.active', (el) => el.dataset.mode));

  // tap gesture on the canvas: pause (was playing via autoplay)
  await page.mouse.click(300, 300);
  await page.waitForTimeout(300);
  console.log('status after tap:', await page.textContent('#status'));
  console.log('play btn after tap:', JSON.stringify(await page.textContent('#btn-play')));

  if (errors.length) {
    console.log('=== ERRORS ===');
    for (const e of errors) console.log(e);
  } else {
    console.log('=== NO PAGE ERRORS ===');
  }
  await browser.close();
})();
