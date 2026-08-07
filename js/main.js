/* ═══════════════════════════════════════════════════════════════
   Kimi K3 — bootstrap & frame loop
   Owns: canvas/DPR, stage geometry (viewport minus overlays),
   the view object, mode/palette/track state, gestures, the mobile
   sheet state machine, desktop panel, keyboard shortcuts, URL params.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

(function () {

  const { clamp, lerp, TAU } = K3.vizUtil;
  const engine = K3.engine;

  /* ── DOM ───────────────────────────────────────────────────── */
  const canvas = document.getElementById('viz');
  const ctx = canvas.getContext('2d', { alpha: false });
  const boot = document.getElementById('boot');
  const sheet = document.getElementById('sheet');
  const sheetBody = document.getElementById('sheet-body');
  const grip = document.getElementById('grip');
  const panel = document.getElementById('panel');
  const panelBody = document.getElementById('panel-body');
  const panelOpenBtn = document.getElementById('panel-open');
  const panelCollapseBtn = document.getElementById('panel-collapse');
  const pill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const fsBtn = document.getElementById('btn-fs');
  const toastBox = document.getElementById('toast');

  const isDesktop = () => window.matchMedia('(min-width: 900px)').matches;

  /* ── State ─────────────────────────────────────────────────── */
  const state = {
    mode: 'spectra',
    palette: 'lunar',
    sens: 1.4,
    vol: 0.8,
    trackId: K3.tracks[0].id,
    source: 'idle',      // idle | track | mic
    playing: false,
    modeSettings: {},    // per-mode, per-key values
  };
  K3.MODE_ORDER.forEach((id) => { state.modeSettings[id] = K3.modeDefaults(id); });

  /* URL params — shareable looks + lets headless tests drive. */
  (function applyParams() {
    const q = new URLSearchParams(location.search);
    if (q.get('mode') && K3.MODES[q.get('mode')]) state.mode = q.get('mode');
    if (q.get('palette') && K3.PALETTES.some((p) => p.id === q.get('palette'))) state.palette = q.get('palette');
    if (q.get('track') && K3.tracks.some((t) => t.id === q.get('track'))) state.trackId = q.get('track');
    if (q.get('sens')) state.sens = clamp(parseFloat(q.get('sens')) || 1.4, 0.5, 2.5);
    if (q.get('vol')) state.vol = clamp(parseFloat(q.get('vol')) || 0.8, 0, 1);
    if (q.get('sheet') && ['full', 'compact', 'hidden'].includes(q.get('sheet'))) {
      sheet.dataset.sheet = q.get('sheet');
      state._sheetParam = true;
    }
    state._autoplay = q.get('autoplay') === '1';
    state._micParam = q.get('src') === 'mic';
  })();

  /* ── Controls: build once, clone into each visible host ────── */
  const master = K3.ui.buildControls();
  const hosts = [sheetBody, panelBody];
  hosts.forEach((h) => h.appendChild(master.cloneNode(true)));

  /* ── Canvas sizing ─────────────────────────────────────────── */
  let vw = 0, vh = 0, dpr = 1;
  let vignette = null;
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = window.innerWidth; vh = window.innerHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    vignette = null;
    refitStage();
    if (viz && viz.resize) viz.resize(view);
  }

  /* ── Stage = viewport minus overlay UI ─────────────────────── */
  const stage = { x: 0, y: 0, w: 0, h: 0 };
  function refitStage() {
    // Never measure during a CSS transition — snap first.
    const prevSheet = sheet.style.transition;
    const prevPanel = panel.style.transition;
    sheet.style.transition = 'none';
    panel.style.transition = 'none';

    const topbarH = parseFloat(getComputedStyle(document.documentElement)
      .getPropertyValue('--topbar-h')) || 58;
    let top = topbarH + 8;
    let bottom = vh;
    let left = 0, right = vw;

    if (isDesktop()) {
      const open = !panel.classList.contains('collapsed');
      if (open) right = vw - (316 + 14 + 24);
    } else {
      const sr = sheet.getBoundingClientRect();
      bottom = Math.min(bottom, sr.top);
    }
    stage.x = left + 10;
    stage.y = top;
    stage.w = Math.max(80, right - left - 20);
    stage.h = Math.max(80, bottom - top - 10);

    sheet.style.transition = prevSheet;
    panel.style.transition = prevPanel;
  }

  /* ── View object (rebuilt refs per frame, no allocation) ───── */
  const view = {
    ctx, w: 0, h: 0, t: 0, dt: 0.016,
    bands: engine.bands, wave: engine.wave,
    energy: 0, bass: 0, mid: 0, treb: 0, kick: 0,
    silent: true, idlePulse: 0,
    settings: null, palette: K3.PALETTES[0],
    stage,
    drawVignette() {
      if (!vignette) {
        vignette = ctx.createRadialGradient(
          vw / 2, vh / 2, Math.min(vw, vh) * 0.42,
          vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.42)');
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, vw, vh);
    },
  };

  /* ── Mode instance lifecycle ───────────────────────────────── */
  let viz = null;
  function ensureMode() {
    if (!viz || viz.id !== state.mode) {
      viz = K3.MODES[state.mode].create();
      viz.resize(view);
    }
    view.settings = state.modeSettings[state.mode];
    view.palette = K3.PALETTES.find((p) => p.id === state.palette) || K3.PALETTES[0];
  }

  /* ── Frame loop ────────────────────────────────────────────── */
  let lastT = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { lastT = now; return; }
    const dt = clamp((now - lastT) / 1000, 0.001, 0.05);
    lastT = now;

    engine.update(state.sens);
    ensureMode();

    view.w = vw; view.h = vh;
    view.t = now / 1000;
    view.dt = dt;
    view.energy = engine.energy; view.bass = engine.bass;
    view.mid = engine.mid; view.treb = engine.treb;
    view.kick = engine.kick; view.silent = engine.silent;
    view.idlePulse = 0.5 + 0.5 * Math.sin(view.t * 1.6);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (engine.silent) {
      // Fully repaint when idle (drift trails leave residue otherwise).
      ctx.fillStyle = '#07070e';
      ctx.fillRect(0, 0, vw, vh);
      drawIdleBackdrop();
    } else if (state.mode !== 'drift' || !view.settings.trails) {
      ctx.fillStyle = '#07070e';
      ctx.fillRect(0, 0, vw, vh);
    }

    viz.frame(view);
    view.drawVignette();
  }

  /* Slow ambient field behind everything, always alive. */
  let stars = null;
  function drawIdleBackdrop() {
    if (!stars) {
      stars = [];
      for (let i = 0; i < 90; i++) {
        stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.3, p: Math.random() * TAU });
      }
    }
    const [c0, c1] = view.palette.colors;
    ctx.save();
    stars.forEach((s, i) => {
      const tw = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(view.t * 0.7 + s.p));
      ctx.fillStyle = (i % 3 ? c0 : c1) + '';
      ctx.globalAlpha = tw * 0.5;
      ctx.beginPath();
      ctx.arc(s.x * vw, s.y * vh, s.r, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  /* ── Status pill ───────────────────────────────────────────── */
  function setStatus(st, text) {
    pill.dataset.state = st;
    statusText.textContent = text;
  }
  function refreshStatus() {
    if (state.source === 'mic') setStatus('mic', 'Microphone');
    else if (state.playing && state.source === 'track') {
      const t = K3.tracks.find((x) => x.id === state.trackId);
      setStatus('playing', t ? t.label : 'Playing');
    } else if (state.source === 'idle' && state.playing === false && state._everPlayed) {
      setStatus('paused', 'Paused');
    } else {
      setStatus('idle', 'Ready');
    }
  }

  /* ── Sync all control hosts from state ─────────────────────── */
  function syncUI() {
    hosts.forEach((h) => {
      K3.ui.syncState(h, {
        mode: state.mode, palette: state.palette,
        source: state.source, trackId: state.trackId,
        playing: state.playing, sens: state.sens, vol: state.vol,
      });
    });
    refreshStatus();
  }
  function syncSettingsUI() {
    hosts.forEach((h) => K3.ui.renderSettings(h, state.mode, state));
    syncUI();
  }

  /* ── Actions ───────────────────────────────────────────────── */
  let toastTimer = 0;
  function toast(msg, isErr) {
    toastBox.textContent = msg;
    toastBox.classList.toggle('error', !!isErr);
    toastBox.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastBox.classList.remove('show'), 2400);
  }
  function buzz() {
    if (navigator.vibrate && navigator.userActivation && navigator.userActivation.isActive) {
      navigator.vibrate(8);
    }
  }

  const actions = {
    playPause() {
      engine.resume().then(() => {
        if (state.playing) {
          engine.stop();
          state.playing = false; state.source = 'idle';
        } else {
          return actions.playTrack(state.trackId);
        }
        syncUI();
      }).catch(() => {});
      buzz();
    },
    playTrack(id) {
      state.trackId = id;
      return engine.playTrack(id).then((def) => {
        state.playing = true; state.source = 'track';
        state._everPlayed = true;
        syncUI();
        toast('▶ ' + def.label);
      }).catch((e) => {
        setStatus('error', 'Audio error');
        toast('Could not start audio — tap again.', true);
      });
    },
    mic() {
      engine.resume().then(() => {
        if (state.source === 'mic') {
          engine.stop();
          state.playing = false; state.source = 'idle';
          syncUI();
          return null;
        }
        return engine.startMic().then(() => {
          state.playing = true; state.source = 'mic';
          state._everPlayed = true;
          syncUI();
          toast('🎙 Microphone live');
        });
      }).catch(() => {
        setStatus('error', 'Mic blocked');
        toast('Microphone unavailable — check permission & HTTPS.', true);
      });
      buzz();
    },
    setMode(id) {
      if (!K3.MODES[id]) return;
      state.mode = id;
      syncSettingsUI();
      refitStage();
      buzz();
    },
    setPalette(id) {
      if (!K3.PALETTES.some((p) => p.id === id)) return;
      state.palette = id;
      if (viz && viz.resize) viz.resize(view); // bust gradient caches
      syncUI();
    },
    setSens(v) {
      state.sens = clamp(v, 0.5, 2.5);
      hosts.forEach((h) => {
        h.querySelectorAll('[data-set="sens"]').forEach((i) => { i.value = state.sens; });
        h.querySelectorAll('[data-out="sens"]').forEach((o) => { o.textContent = state.sens.toFixed(2) + '×'; });
        K3.ui.paintSliderFills(h);
      });
    },
    setVol(v) {
      state.vol = clamp(v, 0, 1);
      engine.setVolume(state.vol);
      hosts.forEach((h) => {
        h.querySelectorAll('[data-set="vol"]').forEach((i) => { i.value = state.vol; });
        h.querySelectorAll('[data-out="vol"]').forEach((o) => { o.textContent = Math.round(state.vol * 100) + '%'; });
        K3.ui.paintSliderFills(h);
      });
    },
    setModeSetting(key, val) {
      const schema = K3.MODES[state.mode].schema.find((s) => s.key === key);
      if (!schema) return;
      state.modeSettings[state.mode][key] = clamp(val, schema.min, schema.max);
      hosts.forEach((h) => {
        h.querySelectorAll(`[data-mode-set="${key}"]`).forEach((i) => { i.value = val; });
        h.querySelectorAll(`[data-mode-out="${key}"]`).forEach((o) => { o.textContent = schema.fmt(state.modeSettings[state.mode][key]); });
      });
      if (key === 'bars' || key === 'count' || key === 'cols') {
        if (viz && viz.resize) viz.resize(view);
      }
    },
    toggleModeSetting(key) {
      const cur = state.modeSettings[state.mode][key];
      state.modeSettings[state.mode][key] = !cur;
      hosts.forEach((h) => {
        h.querySelectorAll(`[data-mode-toggle="${key}"]`).forEach((b) => {
          b.classList.toggle('on', !cur);
          b.setAttribute('aria-checked', String(!cur));
        });
      });
    },
  };

  hosts.forEach((h) => K3.ui.wireHost(h, actions, state));
  pill.addEventListener('click', () => actions.playPause());

  /* ── Fullscreen ────────────────────────────────────────────── */
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener('fullscreenchange', () => setTimeout(resizeCanvas, 60));

  /* ── Desktop panel open/collapse ───────────────────────────── */
  function setPanel(open) {
    panel.classList.toggle('collapsed', !open);
    panelOpenBtn.classList.toggle('hidden', open || !isDesktop());
    refitStage();
  }
  panelCollapseBtn.addEventListener('click', () => setPanel(false));
  panelOpenBtn.addEventListener('click', () => setPanel(true));

  /* ── Mobile sheet state machine (full / compact / hidden) ──── */
  const SHEET_STATES = ['full', 'compact', 'hidden'];
  function setSheet(s) {
    sheet.dataset.sheet = s;
    // Snap transitions off before measuring (never measure mid-flight).
    refitStage();
  }
  (function wireGrip() {
    let startY = 0, startState = 'full', dragging = false;
    grip.addEventListener('pointerdown', (e) => {
      dragging = true;
      startY = e.clientY;
      startState = sheet.dataset.sheet;
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointerup', (e) => {
      if (!dragging) return;
      dragging = false;
      const dy = e.clientY - startY;
      const idx = SHEET_STATES.indexOf(startState);
      if (Math.abs(dy) < 14) {
        // Tap: cycle down one notch, or back to full from hidden.
        setSheet(startState === 'hidden' ? 'full' : SHEET_STATES[Math.min(idx + 1, 2)]);
      } else if (dy > 34) {
        setSheet(SHEET_STATES[Math.min(idx + 1, 2)]);
      } else if (dy < -34) {
        setSheet(SHEET_STATES[Math.max(idx - 1, 0)]);
      }
    });
    grip.addEventListener('pointercancel', () => { dragging = false; });
    grip.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const idx = SHEET_STATES.indexOf(sheet.dataset.sheet);
        setSheet(sheet.dataset.sheet === 'hidden' ? 'full' : SHEET_STATES[Math.min(idx + 1, 2)]);
      }
    });
  })();

  /* ── Canvas gestures: tap = play/pause, swipe = cycle mode ── */
  (function wireGestures() {
    let px = 0, py = 0, pt = 0, tracking = false;
    canvas.addEventListener('pointerdown', (e) => {
      tracking = true; px = e.clientX; py = e.clientY; pt = performance.now();
    });
    canvas.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - px, dy = e.clientY - py;
      const dt = performance.now() - pt;
      if (!isDesktop() && sheet.dataset.sheet !== 'hidden' && Math.abs(dy) < 12 && Math.abs(dx) < 12) {
        setSheet('hidden');                       // first tap dismisses the sheet
        return;
      }
      if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
        const i = K3.MODE_ORDER.indexOf(state.mode);
        const n = K3.MODE_ORDER.length;
        actions.setMode(K3.MODE_ORDER[(i + (dx < 0 ? 1 : n - 1)) % n]);
      } else if (dt < 400 && Math.hypot(dx, dy) < 12) {
        actions.playPause();
      }
    });
    canvas.addEventListener('pointercancel', () => { tracking = false; });
  })();

  /* ── Keyboard shortcuts ────────────────────────────────────── */
  window.addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); actions.playPause(); }
    else if (k >= '1' && k <= String(K3.MODE_ORDER.length)) {
      actions.setMode(K3.MODE_ORDER[Number(k) - 1]);
    }
    else if (k === 'm') actions.mic();
    else if (k === 't') {
      const i = K3.tracks.findIndex((t) => t.id === state.trackId);
      actions.playTrack(K3.tracks[(i + 1) % K3.tracks.length].id);
    }
    else if (k === 'f') fsBtn.click();
    else if (k === 'arrowright' || k === 'arrowleft') {
      const i = K3.MODE_ORDER.indexOf(state.mode);
      const n = K3.MODE_ORDER.length;
      actions.setMode(K3.MODE_ORDER[(i + (k === 'arrowright' ? 1 : n - 1)) % n]);
    }
  });

  /* ── Resize handling ───────────────────────────────────────── */
  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      panelOpenBtn.classList.toggle('hidden', !panel.classList.contains('collapsed') || !isDesktop());
    }, 90);
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize);

  /* ── Boot ──────────────────────────────────────────────────── */
  resizeCanvas();
  if (!isDesktop() && !state._sheetParam) {
    // Default: full on tall screens, compact on short.
    sheet.dataset.sheet = window.innerHeight < 620 ? 'compact' : 'full';
    refitStage();
  }
  if (isDesktop()) setPanel(true);
  syncSettingsUI();
  refitStage();
  requestAnimationFrame(frame);
  setTimeout(() => boot.classList.add('gone'), 350);

  // Autoplay / mic via URL (headless tests use autoplay-policy flags).
  if (state._micParam) {
    setTimeout(() => actions.mic(), 500);
  } else if (state._autoplay) {
    setTimeout(() => actions.playTrack(state.trackId), 500);
  }

  /* Test hook. */
  window.__app = {
    getStage: () => ({ ...stage }),
    state,
    setSheet,
    actions,
    version: 'k3-1.0',
  };

})();
