/* ═══════════════════════════════════════════════════════════════
   Kimi K3 — UI layer
   Renders chips/tiles/swatches/sliders from K3.MODES + K3.PALETTES
   into a single .controls-root container. main.js clones the
   rendered markup into whichever host is visible (mobile sheet
   body or desktop panel body) and events are delegated per host.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.K3 = window.K3 || {};

(function () {

  /* ── Build the controls DOM once ───────────────────────────── */
  function buildControls() {
    const root = document.createElement('div');
    root.className = 'controls-root';

    /* Transport row */
    const transport = el('div', 'row row-transport');
    transport.innerHTML = `
      <button class="play-btn" data-act="play" type="button" aria-label="Play or pause">
        <svg class="ic-play" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.52.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
        <svg class="ic-pause" viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><rect x="6" y="4" width="4.5" height="16" rx="1.4"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.4"/></svg>
      </button>
      <div class="chips" data-role="tracks" role="listbox" aria-label="Audio source"></div>
      <button class="icon-btn mic-btn" data-act="mic" type="button" aria-label="Toggle microphone" title="Microphone (M)">
        <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/></svg>
      </button>`;
    root.appendChild(transport);

    /* Modes row */
    const modesWrap = el('div', 'row row-modes');
    const tiles = el('div', 'tiles');
    tiles.dataset.role = 'modes';
    tiles.setAttribute('role', 'listbox');
    tiles.setAttribute('aria-label', 'Visualization mode');
    K3.MODE_ORDER.forEach((id) => {
      const m = K3.MODES[id];
      const b = el('button', 'tile');
      b.type = 'button';
      b.dataset.mode = id;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-label', m.label);
      b.innerHTML = m.icon + `<span>${m.label}</span>`;
      tiles.appendChild(b);
    });
    modesWrap.appendChild(tiles);
    root.appendChild(modesWrap);

    /* Track chips live inside the transport row on mobile; desktop
       panel CSS re-flows them into a full-width wrapped row. */
    const chips = transport.querySelector('[data-role="tracks"]');
    chips.classList.add('track-chips');

    /* Style row: palettes + per-mode settings */
    const style = el('div', 'row row-style');
    const sw = el('div', 'swatches');
    sw.dataset.role = 'palettes';
    sw.setAttribute('role', 'listbox');
    sw.setAttribute('aria-label', 'Color palette');
    K3.PALETTES.forEach((p) => {
      const b = el('button', 'swatch');
      b.type = 'button';
      b.dataset.palette = p.id;
      b.title = p.label;
      b.setAttribute('role', 'option');
      b.setAttribute('aria-label', p.label);
      b.style.background = `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]} 55%, ${p.colors[2]})`;
      sw.appendChild(b);
    });
    const settings = el('div', 'settings');
    settings.dataset.role = 'settings';
    style.appendChild(sw);
    style.appendChild(settings);
    root.appendChild(style);

    /* Tune row */
    const tune = el('div', 'row row-tune');
    tune.innerHTML = `
      <div class="slider-field">
        <label>Sensitivity <output data-out="sens">1.40×</output></label>
        <input type="range" data-set="sens" min="0.5" max="2.5" step="0.05" value="1.4" aria-label="Sensitivity">
      </div>
      <div class="slider-field">
        <label>Volume <output data-out="vol">80%</output></label>
        <input type="range" data-set="vol" min="0" max="1" step="0.01" value="0.8" aria-label="Volume">
      </div>`;
    root.appendChild(tune);

    /* Track chips */
    const chipsBox = transport.querySelector('[data-role="tracks"]');
    K3.tracks.forEach((t, i) => {
      const c = el('button', 'chip');
      c.type = 'button';
      c.dataset.track = t.id;
      c.setAttribute('role', 'option');
      c.innerHTML = `<span class="chip-num">0${i + 1}</span> ${t.label}`;
      chipsBox.appendChild(c);
    });

    return root;
  }

  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }

  /* ── Per-mode settings rendering ───────────────────────────── */
  function renderSettings(host, modeId, state) {
    const box = host.querySelector('[data-role="settings"]');
    if (!box) return;
    box.innerHTML = '';
    const mode = K3.MODES[modeId];
    const vals = state.modeSettings[modeId];
    mode.schema.forEach((s) => {
      if (s.type === 'range') {
        const f = el('div', 'set-field');
        const lab = el('label', '');
        const name = document.createElement('span');
        name.textContent = s.label;
        const out = document.createElement('output');
        out.dataset.modeOut = s.key;
        out.textContent = s.fmt(vals[s.key]);
        lab.appendChild(name); lab.appendChild(out);
        const inp = document.createElement('input');
        inp.type = 'range';
        inp.min = s.min; inp.max = s.max; inp.step = s.step;
        inp.value = vals[s.key];
        inp.dataset.modeSet = s.key;
        inp.setAttribute('aria-label', s.label);
        f.appendChild(lab); f.appendChild(inp);
        box.appendChild(f);
      } else if (s.type === 'toggle') {
        const f = el('div', 'set-toggle');
        const lab = el('label', '');
        lab.textContent = s.label;
        const t = el('button', 'toggle' + (vals[s.key] ? ' on' : ''));
        t.type = 'button';
        t.dataset.modeToggle = s.key;
        t.setAttribute('role', 'switch');
        t.setAttribute('aria-checked', vals[s.key] ? 'true' : 'false');
        t.setAttribute('aria-label', s.label);
        f.appendChild(lab); f.appendChild(t);
        box.appendChild(f);
      }
    });
    paintSliderFills(box);
  }

  /* Keep the webkit track fill in sync with each slider's value. */
  function paintSliderFills(scope) {
    scope.querySelectorAll('input[type="range"]').forEach((inp) => {
      const min = parseFloat(inp.min), max = parseFloat(inp.max);
      const p = ((parseFloat(inp.value) - min) / (max - min)) * 100;
      inp.style.setProperty('--fill', p + '%');
    });
  }

  /* ── Sync control visuals from state ───────────────────────── */
  function syncState(host, state) {
    host.querySelectorAll('[data-mode]').forEach((b) =>
      b.classList.toggle('active', b.dataset.mode === state.mode));
    host.querySelectorAll('[data-palette]').forEach((b) =>
      b.classList.toggle('active', b.dataset.palette === state.palette));
    host.querySelectorAll('[data-track]').forEach((b) =>
      b.classList.toggle('active', state.source === 'track' && b.dataset.track === state.trackId));
    host.querySelectorAll('[data-act="mic"]').forEach((b) =>
      b.classList.toggle('active', state.source === 'mic'));
    host.querySelectorAll('[data-act="play"]').forEach((b) =>
      b.classList.toggle('playing', !!state.playing));
    host.querySelectorAll('[data-set="sens"]').forEach((i) => { i.value = state.sens; });
    host.querySelectorAll('[data-set="vol"]').forEach((i) => { i.value = state.vol; });
    host.querySelectorAll('[data-out="sens"]').forEach((o) => { o.textContent = Number(state.sens).toFixed(2) + '×'; });
    host.querySelectorAll('[data-out="vol"]').forEach((o) => { o.textContent = Math.round(state.vol * 100) + '%'; });
    paintSliderFills(host);
  }

  /* ── Wire delegated events on a host container ─────────────── */
  function wireHost(host, actions, state) {
    if (host.__k3wired) return;
    host.__k3wired = true;

    host.addEventListener('click', (e) => {
      const t = e.target.closest('[data-act],[data-mode],[data-palette],[data-track],[data-mode-toggle]');
      if (!t || !host.contains(t)) return;
      if (t.dataset.act === 'play') actions.playPause();
      else if (t.dataset.act === 'mic') actions.mic();
      else if (t.dataset.mode) actions.setMode(t.dataset.mode);
      else if (t.dataset.palette) actions.setPalette(t.dataset.palette);
      else if (t.dataset.track) actions.playTrack(t.dataset.track);
      else if (t.dataset.modeToggle) actions.toggleModeSetting(t.dataset.modeToggle);
    });

    host.addEventListener('input', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLInputElement)) return;
      if (t.dataset.set === 'sens') actions.setSens(parseFloat(t.value));
      else if (t.dataset.set === 'vol') actions.setVol(parseFloat(t.value));
      else if (t.dataset.modeSet) actions.setModeSetting(t.dataset.modeSet, parseFloat(t.value));
      paintSliderFills(t.parentElement || host);
    });
  }

  K3.ui = { buildControls, renderSettings, syncState, wireHost, paintSliderFills };

})();
