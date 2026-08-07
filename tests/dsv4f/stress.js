// Thorough QA for Waveform DSV4F: layout assertions across viewports,
// stress interactions, resize churn, chip-row scroll check.
// Usage: LD_LIBRARY_PATH=<armlibs> node dsv4f/stress.js
const { chromium } = require('playwright');
const config = require('../config');

const BASE = config.dsv4f.baseUrl;
const VPS = [
  [320, 568, 'iphone-se-1st'],
  [375, 667, 'iphone-se-2nd'],
  [390, 844, 'iphone-14'],
  [844, 390, 'landscape-phone'],
  [1366, 768, 'laptop-13'],
  [1440, 900, 'laptop-15'],
];

async function layoutCheck(page, label) {
  const issues = await page.evaluate(() => {
    const out = [];
    const vw = innerWidth, vh = innerHeight;
    const sheet = document.getElementById('sheet').getBoundingClientRect();
    if (sheet.bottom > vh + 1) out.push(`sheet bottom ${Math.round(sheet.bottom)} > vh ${vh}`);
    if (sheet.top < -1) out.push(`sheet top ${Math.round(sheet.top)} < 0`);

    // scroll containers (chips/tiles) must fit the viewport; their scrolled
    // children are allowed to extend past it (that's what internal scroll is for)
    for (const el of document.querySelectorAll('.chips, .tiles')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) out.push(`container ${el.className} right ${Math.round(r.right)} > vw ${vw}`);
      if (r.left < -1) out.push(`container ${el.className} left ${Math.round(r.left)} < 0`);
    }

    // non-scrolling controls must fit the viewport horizontally
    for (const el of document.querySelectorAll('.swatch, .switch, .slider')) {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1) out.push(`${el.className} right ${Math.round(r.right)} > vw ${vw}`);
      if (r.left < -1) out.push(`${el.className} left ${Math.round(r.left)} < 0`);
    }

    // all rows must be visible without scrolling (compact tune keeps them on-screen)
    const body = document.getElementById('sheet-body');
    if (body && body.offsetParent !== null) {
      for (const row of body.querySelectorAll('.row')) {
        const r = row.getBoundingClientRect();
        if (r.bottom > sheet.bottom + 1) {
          out.push(`row "${row.className}" bottom ${Math.round(r.bottom)} > sheet bottom ${Math.round(sheet.bottom)}`);
        }
      }
    }

    // play + mic buttons fully on-screen (the original cut-off bug)
    for (const id of ['btn-play', 'btn-mic']) {
      const r = document.getElementById(id).getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) out.push(`${id} off-screen horizontally`);
    }

    if (document.scrollingElement.scrollWidth > vw + 1) out.push('page horizontal overflow');
    return out;
  });
  console.log(`layout [${label}]:`, issues.length ? issues.join(' | ') : 'OK');
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
           '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  const errors = new Set();
  page.on('pageerror', (e) => errors.add(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.add(m.text()); });

  // 1. layout assertions: every viewport, idle + playing states
  for (const [w, h, label] of VPS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/?autoplay=1&track=neon`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1100);
    await layoutCheck(page, `${label} playing`);
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    await layoutCheck(page, `${label} idle`);
  }

  // 2. stress: rapid mode/theme cycling, slider drags, toggles, source switches
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/?autoplay=1&track=neon`, { waitUntil: 'networkidle' });
  for (let i = 0; i < 10; i++) {
    await page.click(`.mode-tile:nth-child(${(i % 5) + 1})`);
    await page.click(`.swatch:nth-child(${(i % 5) + 1})`);
  }
  for (const sel of ['#sens', '#detail', '#vol']) {
    const box = await (await page.$(sel)).boundingBox();
    await page.mouse.click(box.x + box.width * 0.85, box.y + box.height / 2);
  }
  await page.click('#mirror');
  await page.click('[data-track="grid"]');
  await page.waitForTimeout(600);
  await page.click('#btn-mic');
  await page.waitForTimeout(700);
  await page.click('#btn-mic');
  await page.waitForTimeout(400);
  await page.click('[data-track="lofi"]');
  await page.waitForTimeout(400);
  console.log('after stress, status:', JSON.stringify(await page.textContent('#status')));
  console.log('active mode:', await page.$eval('.mode-tile.active', (el) => el.dataset.mode));
  console.log('active track:', await page.$eval('.track.active .chip-label', (el) => el.textContent.trim()));

  // 3. resize churn while playing nebula (state preservation)
  await page.goto(`${BASE}/?mode=nebula&autoplay=1&track=grid`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  for (const [w, h] of [[390, 844], [844, 390], [1366, 768], [390, 844]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
  }
  const lit = await page.evaluate(() => {
    const c = document.getElementById('viz');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 400) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
    return n;
  });
  console.log('nebula still drawing after resize churn:', lit > 0 ? 'yes' : 'NO');

  // 4. chip row must scroll internally instead of overflowing (narrow phone)
  const chips = await page.evaluate(() => {
    const el = document.querySelector('.chips');
    return { scrollW: el.scrollWidth, clientW: el.clientWidth };
  });
  console.log('chips scrollable on 390px:', chips.scrollW > chips.clientW ? 'yes' : 'no', JSON.stringify(chips));

  // 5. mobile sheet state machine + stage centering
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const sheetState = () => page.$eval('#sheet', (el) => el.dataset.sheet);
  const s0 = await sheetState();               // full (tall-phone default)
  await page.click('#sheet-grip');             // full -> compact
  const s1 = await sheetState();
  await page.click('#sheet-grip');             // compact -> full
  const s2 = await sheetState();
  await page.waitForTimeout(200);              // let the debounced stage re-fit settle
  const stageFull = await page.evaluate(() => window.__waveform.getStage());
  const centered = await page.evaluate(() => {
    const s = window.__waveform.getStage();
    const tb = document.getElementById('topbar').getBoundingClientRect();
    const sh = document.getElementById('sheet').getBoundingClientRect();
    return s.y >= tb.bottom && s.y + s.h <= sh.top;
  });
  console.log('stage centered between topbar and sheet:', centered,
    `(y ${Math.round(stageFull.y)}..${Math.round(stageFull.y + stageFull.h)})`);
  // drag the grip down 160px -> hidden
  const gripBox = await (await page.$('#sheet-grip')).boundingBox();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + 160, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const s3 = await sheetState();               // hidden
  const stageHidden = await page.evaluate(() => window.__waveform.getStage());
  console.log('stage grows when menu hides:', stageHidden.h > stageFull.h ? 'yes' : 'no',
    `${Math.round(stageFull.h)} -> ${Math.round(stageHidden.h)}px`);
  await page.click('#sheet-grip');             // hidden -> full
  const s4 = await sheetState();
  await page.mouse.click(200, 200);            // canvas tap dismisses open menu
  await page.waitForTimeout(200);
  const s5 = await sheetState();               // hidden again
  console.log('sheet states:', [s0, s1, s2, s3, s4, s5].join(' -> '));

  console.log('errors:', errors.size ? [...errors] : 'NONE');
  await browser.close();
})();
