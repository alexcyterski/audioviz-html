// Waveform — bootstrap, main loop, control dispatch, canvas gestures.
// URL params: ?mode=spectrum|orbit|nebula|wave|pulse&theme=neon|sunset|ocean|aurora|mono
//             &track=neon|lofi|grid&src=track|mic&autoplay=1&sens=&detail=&vol=&mirror=0
// Canvas gestures: tap = play/pause · swipe left/right = next/previous mode.

import { AudioEngine } from './audio.js';
import { PALETTES, MODES } from './visualizers.js';
import { TRACKS } from './tracks.js';
import { initUI } from './ui.js';

const canvas = document.getElementById('viz');
const ctx2d = canvas.getContext('2d', { alpha: false });
const engine = new AudioEngine();

const params = new URLSearchParams(location.search);
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const vibrate = (ms = 10) => {
  // only vibrate from real user interactions — avoids blocked-call warnings
  // on pages that haven't received a user gesture (e.g. autoplay entry)
  try {
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.isActive) {
      navigator.vibrate(ms);
    }
  } catch {}
};

const state = {
  mode: MODES[params.get('mode')] ? params.get('mode') : 'spectrum',
  theme: PALETTES[params.get('theme')] ? params.get('theme') : 'neon',
  trackId: TRACKS.some((t) => t.id === params.get('track')) ? params.get('track') : 'neon',
  source: params.get('src') === 'mic' ? 'mic' : 'track',
  playing: params.get('autoplay') === '1',
  sens: clamp(parseFloat(params.get('sens')) || 1, 0.3, 3),
  detail: clamp(parseFloat(params.get('detail')) || 1, 0.5, 2),
  mirror: params.get('mirror') !== '0',
  vol: clamp(parseFloat(params.get('vol')) || 0.8, 0, 1),
};

let view = null;
let viz = null;
let t = 0;
let last = performance.now();

function rebuildVignette() {
  const { w, h } = view;
  const g = ctx2d.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  view.vignette = g;
}

function fit() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

  // visible stage: between the top bar and (on mobile) the bottom sheet,
  // so visuals stay centered in the area that isn't covered by the UI
  const topbarEl = document.getElementById('topbar');
  const sheetEl = document.getElementById('sheet');
  const top = (topbarEl ? topbarEl.getBoundingClientRect().bottom : 0) + 6;
  let bottom = h - 6;
  if (window.innerWidth < 1024 && sheetEl) {
    bottom = Math.max(top + 60, sheetEl.getBoundingClientRect().top - 6);
  }

  view = {
    ctx: ctx2d, w, h, dpr, t, dt: 0.016,
    stage: { x: 0, y: top, w, h: bottom - top },
    bands: engine.bands,
    waveNorm: engine.waveNorm,
    energy: 0, bass: 0, mid: 0, treb: 0, kick: 0,
    settings: { sens: state.sens, mirror: state.mirror, detail: state.detail },
    palette: PALETTES[state.theme],
    drawVignette() {
      ctx2d.fillStyle = this.vignette;
      ctx2d.fillRect(0, 0, this.w, this.h);
    },
  };
  rebuildVignette();

  // preserve visualizer state (particles, smoothing) across resizes;
  // only rebuild when the mode actually changed
  if (!viz || viz.id !== state.mode) {
    viz = MODES[state.mode].create();
  }
  if (viz.resize) viz.resize(view);
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) dt = 0.016;
  t += dt;

  engine.update(state.sens);
  view.t = t;
  view.dt = dt;
  view.energy = engine.energy;
  view.bass = engine.bass;
  view.mid = engine.mid;
  view.treb = engine.treb;
  view.kick = engine.kick;
  viz.frame(view);

  if (state.source === 'mic') ui.setLevel(engine.micLevel);
}

/* ---------- actions ---------- */

async function playTrack(id) {
  state.trackId = id;
  state.source = 'track';
  state.playing = true;
  await engine.playTrack(id); // stops mic + previous track internally
  ui.setTrackActive(id);
  ui.setMicActive(false);
  ui.setPlaying(true);
  ui.setStatus('♫ ' + TRACKS.find((t) => t.id === id).name, 'playing');
  vibrate();
}

function togglePlay() {
  if (state.source === 'mic') {
    engine.stopMic();
    state.source = 'track';
    ui.setMicActive(false);
    playTrack(state.trackId);
    return;
  }
  if (state.playing) {
    engine.stopTrack();
    state.playing = false;
    ui.setPlaying(false);
    ui.setStatus('Paused — tap play or the canvas', 'paused');
  } else {
    playTrack(state.trackId);
  }
  vibrate();
}

async function requestMic() {
  if (state.source === 'mic') {
    engine.stopMic();
    state.source = 'track';
    ui.setMicActive(false);
    const name = TRACKS.find((t) => t.id === state.trackId).name;
    ui.setStatus(state.playing ? '♫ ' + name : 'Pick a track', state.playing ? 'playing' : 'idle');
    return;
  }
  state.playing = false;
  ui.setPlaying(false);
  ui.setMicBusy(true);
  try {
    await engine.startMic();
    state.source = 'mic';
    ui.setMicActive(true);
    ui.setStatus('Live mic — speak or play something', 'mic');
    vibrate();
  } catch {
    ui.setStatus('Mic unavailable — check permissions', 'error');
  } finally {
    ui.setMicBusy(false);
  }
}

function setMode(id) {
  state.mode = id;
  viz = MODES[id].create();
  if (viz.resize) viz.resize(view);
  ui.setModeActive(id);
}

function cycleMode(dir) {
  const list = Object.keys(MODES);
  const i = list.indexOf(state.mode);
  setMode(list[(i + dir + list.length) % list.length]);
  vibrate();
}

function setTheme(theme) {
  state.theme = theme;
  view.palette = PALETTES[theme];
  rebuildVignette();
  const accent = PALETTES[theme].colors[0];
  const accent2 = PALETTES[theme].colors[1];
  document.documentElement.style.setProperty('--accent', `rgb(${accent[0]},${accent[1]},${accent[2]})`);
  document.documentElement.style.setProperty('--accent2', `rgb(${accent2[0]},${accent2[1]},${accent2[2]})`);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', `rgb(${PALETTES[theme].bg[0]},${PALETTES[theme].bg[1]},${PALETTES[theme].bg[2]})`);
  ui.setThemeActive(theme);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

/* ---------- canvas gestures: tap = play/pause, swipe = cycle mode ---------- */

let gx = 0, gy = 0, gt = 0;
canvas.addEventListener('pointerdown', (e) => {
  gx = e.clientX;
  gy = e.clientY;
  gt = performance.now();
});
canvas.addEventListener('pointerup', (e) => {
  const dx = e.clientX - gx;
  const dy = e.clientY - gy;
  const dt = performance.now() - gt;
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 2) {
    cycleMode(dx < 0 ? 1 : -1); // swipe left → next mode, right → previous
  } else if (dt < 400 && Math.hypot(dx, dy) < 12) {
    if (ui.dismissSheet()) return; // tap on the canvas hides the menu first
    togglePlay();
  }
});

/* ---------- boot ---------- */

const ui = initUI({
  onMode: setMode,
  onTheme: setTheme,
  onTrack: (id) => playTrack(id), // always; playTrack stops the mic if needed
  onPlayPause: togglePlay,
  onMic: requestMic,
  onSens: (v) => { state.sens = v; view.settings.sens = v; },
  onDetail: (v) => {
    state.detail = v;
    view.settings.detail = v;
    if (viz.resize) viz.resize(view);
  },
  onVol: (v) => { state.vol = v; engine.setVolume(v); },
  onMirror: (v) => { state.mirror = v; view.settings.mirror = v; },
  onFullscreen: toggleFullscreen,
  onSheetChange: () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fit, 60); // re-center visuals as the menu hides/shows
  },
  onNextTrack: () => {
    if (state.source === 'mic') return;
    const i = TRACKS.findIndex((t) => t.id === state.trackId);
    playTrack(TRACKS[(i + 1) % TRACKS.length].id);
  },
  onCycleMode: cycleMode,
});

let debounceTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fit, 150);
});
window.addEventListener('orientationchange', () => setTimeout(fit, 250));

async function boot() {
  fit();
  setTheme(state.theme);
  setMode(state.mode);
  ui.setThemeActive(state.theme);
  ui.setModeActive(state.mode);
  ui.setTrackActive(state.trackId);
  ui.setSliders(state);
  engine.setVolume(state.vol);

  if (state.source === 'mic') {
    try {
      await engine.startMic();
      ui.setMicActive(true);
      ui.setStatus('Live mic — speak or play something', 'mic');
    } catch {
      state.source = 'track';
      ui.setStatus('Mic unavailable — pick a track', 'error');
    }
  } else if (state.playing) {
    try {
      await playTrack(state.trackId);
    } catch (err) {
      ui.setStatus('Audio error: ' + err.message, 'error');
    }
  } else {
    ui.setStatus('Pick a track or tap the canvas', 'idle');
  }

  requestAnimationFrame(frame);
}

boot();

// test/debug hook: stage = the visible area visuals are centered in
window.__waveform = { getStage: () => (view ? { x: view.stage.x, y: view.stage.y, w: view.stage.w, h: view.stage.h } : null) };
