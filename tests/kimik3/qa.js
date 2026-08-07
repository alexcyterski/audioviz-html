/* Kimi K3 visualizer — headless QA suite.
   Loads every mode × a palette rotation with autoplay, asserts:
     - zero page errors / console errors
     - canvas is actually drawing (pixel-lit check)
     - stage geometry is sane (window.__app.getStage)
     - mobile layout: sheet fits, controls on-screen
   Screenshots land in tests/shots/kimi-k3/.
*/
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const config = require('../config');

const BASE = process.env.K3_URL || 'http://localhost:8901';
const OUT = path.join(config.shotsDir, 'kimi-k3');
fs.mkdirSync(OUT, { recursive: true });

const MODES = ['spectra', 'halo', 'drift', 'ribbon', 'bloom', 'matrix'];
const PALETTES = ['lunar', 'nebula', 'solar', 'aurora', 'mono', 'ember'];

let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ FAIL:', msg); };
const pass = (msg) => console.log('  ✓', msg);

async function litPixels(page) {
  return page.evaluate(() => {
    const c = document.getElementById('viz');
    const g = c.getContext('2d');
    const { width, height } = c;
    const data = g.getImageData(0, 0, width, height).data;
    let lit = 0, total = 0;
    for (let i = 0; i < data.length; i += 4 * 97) {
      total++;
      // background is #07070e → ~ (7,7,14)
      if (data[i] > 24 || data[i + 1] > 24 || data[i + 2] > 30) lit++;
    }
    return { lit, total, pct: (lit / total * 100).toFixed(1) };
  });
}

async function energy(page) {
  return page.evaluate(() => ({
    energy: +(K3.engine.energy || 0).toFixed(3),
    bass: +(K3.engine.bass || 0).toFixed(3),
    source: window.__app.state.source,
    playing: window.__app.state.playing,
  }));
}

async function newPage(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  page.__errors = errors;
  return page;
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    env: { ...process.env, LD_LIBRARY_PATH: config.armLibPath },
    args: config.launchArgs,
  });

  /* ── 1 · Mode sweep (mobile viewport, autoplay) ─────────────── */
  console.log('═══ 1. Mode sweep (390×844, autoplay) ═══');
  for (let i = 0; i < MODES.length; i++) {
    const mode = MODES[i];
    const palette = PALETTES[i % PALETTES.length];
    const page = await newPage(browser, 390, 844);
    await page.goto(`${BASE}/?mode=${mode}&palette=${palette}&autoplay=1&sheet=hidden`);
    await page.waitForTimeout(4200);

    const px = await litPixels(page);
    const en = await energy(page);
    console.log(` ${mode}/${palette}: lit=${px.pct}% energy=${en.energy} playing=${en.playing}`);
    if (page.__errors.length) fail(`${mode}: JS errors — ${page.__errors.join(' | ')}`);
    if (px.lit / px.total < 0.01) fail(`${mode}: canvas nearly blank (${px.pct}%)`);
    if (!en.playing) fail(`${mode}: not playing after autoplay`);
    if (en.energy <= 0.005) fail(`${mode}: analyser energy ~0 (no audio data?)`);
    await page.screenshot({ path: path.join(OUT, `mode-${mode}-${palette}.png`) });
    if (!page.__errors.length && px.lit / px.total >= 0.01 && en.playing && en.energy > 0.005) pass(mode);
    await page.context().close();
  }

  /* ── 2 · Palette sweep on one mode ──────────────────────────── */
  console.log('═══ 2. Palette sweep (spectra) ═══');
  for (const palette of PALETTES) {
    const page = await newPage(browser, 390, 844);
    await page.goto(`${BASE}/?mode=spectra&palette=${palette}&autoplay=1&sheet=hidden`);
    await page.waitForTimeout(2600);
    if (page.__errors.length) fail(`palette ${palette}: ${page.__errors.join(' | ')}`);
    await page.screenshot({ path: path.join(OUT, `palette-${palette}.png`) });
    await page.context().close();
  }
  pass('palettes rendered');

  /* ── 3 · Sheet states + layout assertions (mobile) ──────────── */
  console.log('═══ 3. Mobile layout (390×844) ═══');
  {
    const page = await newPage(browser, 390, 844);
    await page.goto(`${BASE}/?autoplay=1`);
    await page.waitForTimeout(3000);

    for (const st of ['full', 'compact', 'hidden']) {
      await page.evaluate((s) => window.__app.setSheet(s), st);
      await page.waitForTimeout(450);
      const geo = await page.evaluate(() => {
        const sheet = document.getElementById('sheet').getBoundingClientRect();
        const stage = window.__app.getStage();
        const play = document.querySelector('#sheet-body [data-act="play"]').getBoundingClientRect();
        const mic = document.querySelector('#sheet-body [data-act="mic"]').getBoundingClientRect();
        return {
          sheet: { top: sheet.top, bottom: sheet.bottom },
          stage, play: { x: play.x, right: play.right }, mic: { right: mic.right },
          vw: innerWidth, vh: innerHeight,
        };
      });
      console.log(` sheet=${st}: stage=${JSON.stringify(geo.stage)} sheetTop=${Math.round(geo.sheet.top)}`);
      if (st !== 'hidden') {
        if (geo.play.x < 0 || geo.mic.right > geo.vw + 1) fail(`sheet=${st}: transport buttons off-screen`);
        if (geo.sheet.bottom > geo.vh + 2) fail(`sheet=${st}: sheet extends past viewport`);
      }
      if (geo.stage.h < 80) fail(`sheet=${st}: stage height collapsed (${geo.stage.h})`);
      await page.screenshot({ path: path.join(OUT, `sheet-${st}.png`) });
    }
    if (page.__errors.length) fail('layout: ' + page.__errors.join(' | '));
    await page.context().close();
    pass('mobile layout');
  }

  /* ── 4 · Desktop layout + panel ─────────────────────────────── */
  console.log('═══ 4. Desktop (1440×900) ═══');
  {
    const page = await newPage(browser, 1440, 900);
    await page.goto(`${BASE}/?autoplay=1&mode=halo`);
    await page.waitForTimeout(3500);
    const geo = await page.evaluate(() => {
      const panel = document.getElementById('panel').getBoundingClientRect();
      const stage = window.__app.getStage();
      return { panel: { right: panel.right, bottom: panel.bottom, width: panel.width }, stage, vw: innerWidth, vh: innerHeight };
    });
    console.log(` panel=${JSON.stringify(geo.panel)} stage=${JSON.stringify(geo.stage)}`);
    if (geo.panel.right > geo.vw + 1 || geo.panel.bottom > geo.vh + 1) fail('desktop: panel off-screen');
    if (geo.stage.x + geo.stage.w > geo.panel.right - 14 + 40) fail('desktop: stage may underlap panel');
    const px = await litPixels(page);
    console.log(` lit=${px.pct}%`);
    if (px.lit / px.total < 0.01) fail('desktop: canvas blank');
    if (page.__errors.length) fail('desktop: ' + page.__errors.join(' | '));
    await page.screenshot({ path: path.join(OUT, 'desktop-halo.png') });
    await page.context().close();
    pass('desktop');
  }

  /* ── 5 · Mic path (fake device) ─────────────────────────────── */
  console.log('═══ 5. Mic source ═══');
  {
    const page = await newPage(browser, 390, 844);
    await page.goto(`${BASE}/?src=mic&mode=ribbon&sheet=hidden`);
    await page.waitForTimeout(3500);
    const en = await energy(page);
    console.log(` source=${en.source} playing=${en.playing} energy=${en.energy}`);
    if (en.source !== 'mic') fail('mic: source did not switch to mic');
    if (page.__errors.length) fail('mic: ' + page.__errors.join(' | '));
    await page.screenshot({ path: path.join(OUT, 'mic-ribbon.png') });
    await page.context().close();
    pass('mic path');
  }

  /* ── 6 · Source-switch stress (leak / error check) ─────────── */
  console.log('═══ 6. Stress: rapid source + mode switching ═══');
  {
    const page = await newPage(browser, 390, 844);
    await page.goto(`${BASE}/?autoplay=1`);
    await page.waitForTimeout(2500);
    const tracks = await page.evaluate(() => K3.tracks.map((t) => t.id));
    for (let i = 0; i < 12; i++) {
      await page.evaluate((t) => window.__app.actions.playTrack(t), tracks[i % tracks.length]);
      await page.evaluate((m) => window.__app.actions.setMode(m), MODES[i % MODES.length]);
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(1500);
    const en = await energy(page);
    console.log(` after stress: playing=${en.playing} energy=${en.energy}`);
    if (!en.playing) fail('stress: stopped playing');
    if (page.__errors.length) fail('stress: ' + page.__errors.join(' | '));
    await page.context().close();
    pass('stress');
  }

  /* ── 7 · Small phone (360×640) ──────────────────────────────── */
  console.log('═══ 7. Small phone (360×640) ═══');
  {
    const page = await newPage(browser, 360, 640);
    await page.goto(`${BASE}/?autoplay=1&mode=matrix`);
    await page.waitForTimeout(3200);
    const geo = await page.evaluate(() => {
      const sheet = document.getElementById('sheet').getBoundingClientRect();
      const stage = window.__app.getStage();
      return { sheetBottom: sheet.bottom, stage, vh: innerHeight, state: document.getElementById('sheet').dataset.sheet };
    });
    console.log(` sheet=${geo.state} bottom=${Math.round(geo.sheetBottom)}/${geo.vh} stageH=${geo.stage.h}`);
    if (geo.sheetBottom > geo.vh + 2) fail('small: sheet overflows');
    if (page.__errors.length) fail('small: ' + page.__errors.join(' | '));
    await page.screenshot({ path: path.join(OUT, 'small-matrix.png') });
    await page.context().close();
    pass('small phone');
  }

  await browser.close();
  console.log(`\n═══ DONE — ${failures} failure(s). Shots in ${OUT} ═══`);
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('SUITE CRASH:', e); process.exit(2); });
