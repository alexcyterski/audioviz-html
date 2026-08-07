// UI wiring — mode tiles, track chips, sliders, swatches, keyboard shortcuts.
// Mobile sheet states: full (everything) | compact (tune row hidden) | hidden (grip only).
// Grip tap cycles states, drag the grip down to hide, tap the canvas to dismiss.

import { MODE_LIST } from './visualizers.js';
import { PALETTES } from './visualizers.js';
import { TRACKS } from './tracks.js';

export function initUI(cb) {
  const $ = (id) => document.getElementById(id);

  const trackChipsEl = $('track-chips');
  const modeTilesEl = $('mode-tiles');
  const swatchesEl = $('theme-swatches');
  const statusEl = $('status');
  const micDot = $('mic-dot');
  const playBtn = $('btn-play');
  const micBtn = $('btn-mic');
  const sheet = $('sheet');
  const grip = $('sheet-grip');
  const fullscreenBtn = $('btn-fullscreen');

  /* ---------- mobile sheet state machine ---------- */
  const isMobile = () => window.innerWidth < 1024;
  // tall phones: everything visible by default; short screens: slim start
  if (isMobile()) sheet.dataset.sheet = window.innerHeight < 620 ? 'compact' : 'full';

  function setSheet(s) {
    if (isMobile()) {
      sheet.dataset.sheet = s;
      if (cb.onSheetChange) cb.onSheetChange();
    }
  }
  function toggleSheet() {
    const cur = sheet.dataset.sheet || 'full';
    setSheet(cur === 'hidden' ? 'full' : cur === 'full' ? 'compact' : 'full');
  }

  // drag the grip down to hide the menu
  let dragStart = 0;
  let dragging = false;
  let dragDy = 0;
  grip.addEventListener('pointerdown', (e) => {
    if (!isMobile()) return;
    dragging = true;
    dragStart = e.clientY;
    dragDy = 0;
    sheet.style.transition = 'none';
    e.preventDefault();
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dragDy = Math.max(0, e.clientY - dragStart);
    sheet.style.transform = `translateY(${Math.min(dragDy, sheet.offsetHeight)}px)`;
  });
  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = dragDy;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (dy <= 12) {
      toggleSheet(); // a tap
    } else if (dy > 90 || dy > sheet.offsetHeight * 0.35) {
      sheet.style.transition = 'none'; // snap: no slide-back animation, so the
      // stage re-fit measures the settled position instead of a mid-flight one
      setSheet('hidden'); // a drag down
    }
  });
  grip.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleSheet();
    }
  });

  /* --- build track chips (mini EQ on the active one) --- */
  for (const t of TRACKS) {
    const b = document.createElement('button');
    b.className = 'chip track';
    b.dataset.track = t.id;
    b.innerHTML =
      '<span class="chip-eq" aria-hidden="true"><i></i><i></i><i></i></span>' +
      `<span class="chip-label">♫ ${t.name}</span>`;
    b.addEventListener('click', () => cb.onTrack(t.id));
    trackChipsEl.appendChild(b);
  }

  /* --- build mode tiles --- */
  for (const m of MODE_LIST) {
    const b = document.createElement('button');
    b.className = 'mode-tile';
    b.dataset.mode = m.id;
    b.innerHTML = `<span class="tile-icon">${m.icon}</span><span class="tile-label">${m.label}</span>`;
    b.addEventListener('click', () => cb.onMode(m.id));
    modeTilesEl.appendChild(b);
  }

  /* --- build theme swatches --- */
  for (const key of Object.keys(PALETTES)) {
    const p = PALETTES[key];
    const b = document.createElement('button');
    b.className = 'swatch';
    b.title = p.name;
    const [c1, c2] = p.colors;
    b.style.background = `linear-gradient(135deg, rgb(${c1[0]},${c1[1]},${c1[2]}), rgb(${c2[0]},${c2[1]},${c2[2]}))`;
    b.dataset.theme = key;
    b.addEventListener('click', () => cb.onTheme(key));
    swatchesEl.appendChild(b);
  }

  /* --- sliders with live value bubbles --- */
  const sliders = [
    { el: $('sens'), val: $('sens-val'), fmt: (v) => v.toFixed(1) + '×', cb: cb.onSens },
    { el: $('detail'), val: $('detail-val'), fmt: (v) => v.toFixed(1) + '×', cb: cb.onDetail },
    { el: $('vol'), val: $('vol-val'), fmt: (v) => Math.round(v * 100) + '%', cb: cb.onVol },
  ];
  for (const s of sliders) {
    s.el.addEventListener('input', () => {
      const v = parseFloat(s.el.value);
      s.val.textContent = s.fmt(v);
      s.cb(v);
    });
  }

  /* --- bindings --- */
  playBtn.addEventListener('click', cb.onPlayPause);
  micBtn.addEventListener('click', cb.onMic);
  $('mirror').addEventListener('change', (e) => cb.onMirror(e.target.checked));
  fullscreenBtn.addEventListener('click', cb.onFullscreen);

  if (!document.fullscreenEnabled) fullscreenBtn.style.display = 'none';

  /* --- keyboard shortcuts (desktop) --- */
  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, button')) return;
    switch (e.key) {
      case ' ':
        e.preventDefault();
        cb.onPlayPause();
        break;
      case 'm': case 'M': cb.onMic(); break;
      case 'f': case 'F': cb.onFullscreen(); break;
      case 't': case 'T': cb.onNextTrack(); break;
      case 'ArrowLeft': cb.onCycleMode(-1); break;
      case 'ArrowRight': cb.onCycleMode(1); break;
      default:
        if (e.key >= '1' && e.key <= '5') cb.onMode(MODE_LIST[+e.key - 1].id);
    }
  });

  /* --- state setters --- */
  let lastLevel = -1;
  return {
    setModeActive(id) {
      for (const b of modeTilesEl.children) b.classList.toggle('active', b.dataset.mode === id);
    },
    setThemeActive(theme) {
      for (const b of swatchesEl.children) b.classList.toggle('active', b.dataset.theme === theme);
    },
    setTrackActive(id) {
      for (const b of trackChipsEl.children) b.classList.toggle('active', b.dataset.track === id);
    },
    setMicActive(on) {
      micBtn.classList.toggle('live', on);
      micBtn.innerHTML = on ? '🎤&nbsp;Mic&nbsp;on' : '🎤&nbsp;Mic';
      micDot.classList.toggle('hidden', !on);
    },
    setPlaying(on) {
      playBtn.innerHTML = on ? '⏸&nbsp;Pause' : '▶&nbsp;Play';
      playBtn.classList.toggle('active', on);
      for (const b of trackChipsEl.children) b.classList.toggle('playing', on);
    },
    setMicBusy(busy) {
      micBtn.disabled = busy;
      micBtn.innerHTML = busy ? '🎤&nbsp;…' : '🎤&nbsp;Mic';
    },
    setStatus(text, kind = 'idle') {
      statusEl.dataset.kind = kind;
      statusEl.querySelector('.status-text').textContent = text;
    },
    setLevel(v) {
      if (Math.abs(v - lastLevel) < 0.05) return;
      lastLevel = v;
      micDot.style.opacity = 0.25 + v * 0.75;
      micDot.style.transform = `scale(${0.6 + v * 0.9})`;
    },
    setSliders(state) {
      $('sens').value = state.sens;
      $('detail').value = state.detail;
      $('vol').value = state.vol;
      $('mirror').checked = state.mirror;
      $('sens-val').textContent = state.sens.toFixed(1) + '×';
      $('detail-val').textContent = state.detail.toFixed(1) + '×';
      $('vol-val').textContent = Math.round(state.vol * 100) + '%';
    },
    /** Tap-on-canvas helper: hides the menu if it's covering the view. */
    dismissSheet() {
      if (!isMobile()) return false;
      if (sheet.dataset.sheet !== 'hidden') {
        setSheet('hidden');
        return true;
      }
      return false;
    },
  };
}
