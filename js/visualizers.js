/* ═══════════════════════════════════════════════════════════════
   Kimi K3 — palettes + visualization modes
   MODES is a factory registry: create() MUST return
   Object.assign(Object.create(this), {state}) so frame/resize are
   inherited from the registry object (bare state = runtime crash).

   View contract (built by main.js each frame):
   { ctx, w, h, t, dt, bands[64], wave[512], energy, bass, mid, treb,
     kick, silent, settings (mutable), palette (mutable), stage,
     drawVignette(), idlePulse }
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.K3 = window.K3 || {};

(function () {

  const TAU = Math.PI * 2;
  const lerp = (a, b, m) => a + (b - a) * m;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // VU feel: fast attack, slow release.
  const vu = (cur, target, up = 0.7, down = 0.1) =>
    cur + (target - cur) * (target > cur ? up : down);

  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  /* Parse any supported color string (#hex or rgb()/rgba()) → [r,g,b]. */
  function anyRgb(col) {
    if (col[0] === '#') return hexRgb(col);
    const m = col.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    return m ? [+m[1], +m[2], +m[3]] : [255, 255, 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = anyRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  function mix(h1, h2, m) {
    const a = anyRgb(h1), b = anyRgb(h2);
    return `rgb(${Math.round(lerp(a[0], b[0], m))},${Math.round(lerp(a[1], b[1], m))},${Math.round(lerp(a[2], b[2], m))})`;
  }
  function mixA(h1, h2, m, alpha) {
    const a = anyRgb(h1), b = anyRgb(h2);
    return `rgba(${Math.round(lerp(a[0], b[0], m))},${Math.round(lerp(a[1], b[1], m))},${Math.round(lerp(a[2], b[2], m))},${alpha})`;
  }

  /* ── Palettes ──────────────────────────────────────────────── */
  const PALETTES = [
    { id: 'lunar',   label: 'Lunar Mist',  colors: ['#7c5cff', '#38e1ff', '#eaf6ff'] },
    { id: 'nebula',  label: 'Nebula',      colors: ['#c084fc', '#f472b6', '#38bdf8'] },
    { id: 'solar',   label: 'Solar Flare', colors: ['#ff9d2e', '#ff5470', '#ffe66d'] },
    { id: 'aurora',  label: 'Aurora',      colors: ['#3ddc97', '#38e1ff', '#b8ffe9'] },
    { id: 'mono',    label: 'Monochrome',  colors: ['#9aa4ff', '#e8e9ff', '#ffffff'] },
    { id: 'ember',   label: 'Ember',       colors: ['#ff4d6d', '#ff8fa3', '#ffd6dd'] },
  ];

  /* ── Setting schema helpers (ui.js renders from these) ─────── */
  const S = {
    range: (key, label, min, max, step, def, fmt) =>
      ({ type: 'range', key, label, min, max, step, def, fmt: fmt || ((v) => String(v)) }),
    toggle: (key, label, def) => ({ type: 'toggle', key, label, def }),
  };
  const pct = (v) => Math.round(v * 100) + '%';

  function defaults(schema) {
    const o = {};
    schema.forEach((s) => { o[s.key] = s.def; });
    return o;
  }

  /* Sample n points from the 64 bands, VU-smoothed into `into`. */
  function sampleBands(v, n, into) {
    const bands = v.bands;
    for (let i = 0; i < n; i++) {
      const pos = (i / (n - 1)) * (bands.length - 1);
      const i0 = pos | 0;
      const target = lerp(bands[i0], bands[Math.min(i0 + 1, bands.length - 1)], pos - i0);
      into[i] = vu(into[i], target);
    }
    return into;
  }

  /* ═══════════════════════════════════════════════════════════
     1 · SPECTRA — classic bars with peaks, mirrored from center
     ═══════════════════════════════════════════════════════════ */
  const spectra = {
    id: 'spectra', label: 'Spectra',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="10" width="3" height="11" rx="1.5"/><rect x="8" y="4" width="3" height="17" rx="1.5"/><rect x="13" y="8" width="3" height="13" rx="1.5"/><rect x="18" y="13" width="3" height="8" rx="1.5"/></svg>',
    schema: [
      S.range('bars', 'Bars', 16, 64, 1, 0, (v) => v === 0 ? 'Auto' : String(v)),
      S.toggle('mirror', 'Mirror', true),
      S.toggle('peaks', 'Peak marks', true),
      S.toggle('glow', 'Glow', true),
    ],
    defaults() { return { bars: 0, mirror: true, peaks: true, glow: true }; },
    create() {
      return Object.assign(Object.create(this), {
        sm: new Float32Array(64),
        peak: new Float32Array(64),
        grad: null, gw: 0, gh: 0,
      });
    },
    resize(v) { this.grad = null; },
    frame(v) {
      const { ctx, stage: st, palette } = v;
      const s = v.settings;
      const n = s.bars > 0 ? s.bars : clamp(Math.round(st.w / (v.w < 600 ? 18 : 26)), 16, 56);
      const vals = sampleBands(v, n, this.sm);
      const [c0, c1, c2] = palette.colors;

      const baseY = st.y + st.h * (s.mirror ? 0.5 : 0.97);
      const maxH = st.h * (s.mirror ? 0.42 : 0.82) * (0.35 + 0.65 * clamp(v.energy * 2.2, 0.25, 1));
      const gap = Math.max(2, st.w / n * 0.22);
      const bw = (st.w - gap * (n - 1)) / n;
      const r = Math.min(bw / 2, 4);

      // Cache the vertical gradient per resize/palette change.
      const gkey = maxH + palette.id + (s.mirror ? 'm' : '');
      if (this._gkey !== gkey) {
        this._gkey = gkey;
        this.grad = ctx.createLinearGradient(0, baseY + (s.mirror ? maxH : 0), 0, baseY - maxH);
        this.grad.addColorStop(0, c0);
        this.grad.addColorStop(0.62, c1);
        this.grad.addColorStop(1, c2);
      }

      if (s.glow) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rgba(c0, 0.10 + v.kick * 0.5);
        ctx.fillRect(st.x, baseY - maxH - 8, st.w, maxH * (s.mirror ? 2 : 1) + 16);
        ctx.restore();
      }

      ctx.fillStyle = this.grad;
      for (let i = 0; i < n; i++) {
        const h = Math.max(vals[i] * maxH, 2.5);
        const x = st.x + i * (bw + gap);
        if (s.mirror) {
          ctx.beginPath();
          ctx.roundRect(x, baseY - h, bw, h * 2, r);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.roundRect(x, baseY - h, bw, h, [r, r, 0, 0]);
          ctx.fill();
        }
        // Falling peak diamonds.
        if (s.peaks) {
          this.peak[i] = Math.max(this.peak[i] - maxH * 0.006, h);
          const py = baseY - this.peak[i] - 7;
          if (this.peak[i] > 6) {
            ctx.save();
            ctx.translate(x + bw / 2, s.mirror ? py - 3 : py);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.35 * (this.peak[i] / maxH)})`;
            const d = clamp(bw * 0.32, 2, 4.5);
            ctx.fillRect(-d / 2, -d / 2, d, d);
            ctx.restore();
            ctx.fillStyle = this.grad;
          }
        }
      }
    },
  };

  /* ═══════════════════════════════════════════════════════════
     2 · HALO — radial ring of spokes
     ═══════════════════════════════════════════════════════════ */
  const halo = {
    id: 'halo', label: 'Halo',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M19.4 4.6l-2.1 2.1M6.7 17.3l-2.1 2.1"/></svg>',
    schema: [
      S.range('spokes', 'Spokes', 32, 120, 4, 72, (v) => String(v)),
      S.range('baseR', 'Core size', 0.1, 0.42, 0.01, 0.24, pct),
      S.toggle('spin', 'Spin', true),
      S.toggle('dashes', 'Dash ring', true),
    ],
    defaults() { return { spokes: 72, baseR: 0.24, spin: true, dashes: true }; },
    create() {
      return Object.assign(Object.create(this), {
        sm: new Float32Array(128), rot: 0,
      });
    },
    resize() {},
    frame(v) {
      const { ctx, stage: st, palette } = v;
      const s = v.settings;
      const [c0, c1, c2] = palette.colors;
      const n = clamp(Math.round(s.spokes), 32, 120);
      const vals = sampleBands(v, n, this.sm);

      const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
      const maxR = Math.min(st.w, st.h) * 0.46;
      const baseR = maxR * s.baseR * (1 + v.bass * 0.16 + v.kick * 0.9);
      if (s.spin) this.rot += v.dt * (0.06 + v.energy * 0.5);

      // Guide rings (depth layer).
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let g = 1; g <= 3; g++) {
        ctx.beginPath();
        ctx.arc(cx, cy, baseR + (maxR - baseR) * g / 3, 0, TAU);
        ctx.stroke();
      }

      // Spokes: dual pass — wide low-alpha glow, then bright core.
      const spokeW = clamp(st.w / n * 0.3, 1.4, 4);
      ctx.lineCap = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < n; i++) {
          const a = this.rot + (i / n) * TAU;
          const m = vals[i];
          const len = Math.max(Math.pow(m, 0.8) * (maxR - baseR), 1.5);
          const x0 = cx + Math.cos(a) * baseR, y0 = cy + Math.sin(a) * baseR;
          const x1 = cx + Math.cos(a) * (baseR + len), y1 = cy + Math.sin(a) * (baseR + len);
          if (pass === 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = mixA(c0, c1, m, 0.10 + m * 0.14);
            ctx.lineWidth = spokeW * 3.2;
          } else {
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = mixA(m < 0.55 ? c0 : c1, m < 0.55 ? c1 : c2, m < 0.55 ? m / 0.55 : (m - 0.55) / 0.45, 0.92);
            ctx.lineWidth = spokeW;
          }
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          if (pass === 1) {
            ctx.fillStyle = mixA(c1, c2, m, 0.35 + m * 0.55);
            ctx.beginPath(); ctx.arc(x1, y1, 1.7 + m * 2.6, 0, TAU); ctx.fill();
          }
        }
      }
      ctx.globalCompositeOperation = 'source-over';

      // Core.
      const coreR = baseR * 0.82;
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
      cg.addColorStop(0, rgba(c2, 0.16 + v.energy * 0.3));
      cg.addColorStop(1, rgba(c0, 0.02));
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(c1, 0.4 + v.kick * 2);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, TAU); ctx.stroke();

      // Rotating dash ring.
      if (s.dashes) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-this.rot * 1.7);
        ctx.strokeStyle = rgba(c2, 0.35);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 11]);
        ctx.beginPath(); ctx.arc(0, 0, maxR * 1.02, 0, TAU); ctx.stroke();
        ctx.restore();
      }
    },
  };

  /* ═══════════════════════════════════════════════════════════
     3 · DRIFT — floating audio-reactive particle field
     ═══════════════════════════════════════════════════════════ */
  const drift = {
    id: 'drift', label: 'Drift',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="7" r="1.8"/><circle cx="12" cy="4" r="1.3"/><circle cx="19" cy="8" r="2.1"/><circle cx="8" cy="14" r="1.4"/><circle cx="16" cy="15" r="1.7"/><circle cx="5" cy="19" r="1.2"/><circle cx="12" cy="20" r="2"/><circle cx="20" cy="19" r="1.3"/></svg>',
    schema: [
      S.range('count', 'Particles', 60, 360, 10, 180, (v) => String(v)),
      S.range('link', 'Link dist', 0, 0.2, 0.005, 0.085, pct),
      S.range('speed', 'Drift', 0.2, 2.5, 0.05, 1, (v) => v.toFixed(2) + '×'),
      S.toggle('trails', 'Trails', true),
    ],
    defaults() { return { count: 180, link: 0.085, speed: 1, trails: true }; },
    create() {
      return Object.assign(Object.create(this), {
        pts: [], hue: 0, _n: 0,
      });
    },
    resize(v) { this._pendingSpawn = true; },
    _spawn(v, keep) {
      const st = v.stage;
      const want = clamp(Math.round(v.settings.count * clamp(st.w * st.h / (390 * 700), 0.45, 1.6)), 40, 400);
      const pts = this.pts;
      if (!keep || pts.length > want) pts.length = 0;
      while (pts.length < want) {
        // Cluster spawn toward the middle band of the stage.
        const rx = (Math.random() + Math.random() + Math.random()) / 3;
        const ry = (Math.random() + Math.random() + Math.random()) / 3;
        pts.push({
          x: rx * st.w, y: ry * st.h,
          vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
          r: 0.8 + Math.random() * 2.1,
          band: (Math.random() * 64) | 0,
          tw: Math.random() * TAU,
        });
      }
      if (keep) pts.forEach((p) => {
        p.x = clamp(p.x, 0, st.w); p.y = clamp(p.y, 0, st.h);
      });
    },
    frame(v) {
      const { ctx, stage: st, palette } = v;
      const s = v.settings;
      const [c0, c1, c2] = palette.colors;
      if (this._pendingSpawn) { this._pendingSpawn = false; this._spawn(v, true); }
      if (this._n !== Math.round(s.count)) { this._n = Math.round(s.count); this._spawn(v, false); }
      if (!this.pts.length) this._spawn(v, false);

      // Trails: translucent stage-covering fade.
      if (s.trails) {
        ctx.fillStyle = 'rgba(7,7,14,0.22)';
        ctx.fillRect(st.x, st.y, st.w, st.h);
      } else {
        ctx.clearRect(st.x, st.y, st.w, st.h);
      }

      this.hue += v.dt * 0.15;
      const linkD = s.link * Math.min(st.w, st.h);
      const cx = st.w / 2, cy = st.h / 2;

      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.globalCompositeOperation = 'lighter';

      const pts = this.pts;
      // Links first (under dots).
      if (linkD > 4) {
        ctx.lineWidth = 0.7;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i];
          for (let j = i + 1; j < pts.length; j++) {
            const b = pts[j];
            const dx = a.x - b.x, dy = a.y - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < linkD * linkD) {
              const al = (1 - Math.sqrt(d2) / linkD) * (0.10 + v.energy * 0.3);
              ctx.strokeStyle = mixA(c0, c1, (a.band + b.band) / 128, al);
              ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
            }
          }
        }
      }
      // Dots.
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const react = v.bands[p.band];
        // Gentle swirl around center + drift + soft inward pull.
        const dx = cx - p.x, dy = cy - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const swirl = 0.14 * s.speed * (0.3 + v.energy);
        p.vx += (-dy / dist) * swirl + (dx / dist) * 0.055;
        p.vy += (dx / dist) * swirl + (dy / dist) * 0.055;
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx * s.speed * (1 + react * 3) * v.dt * 60 * 0.16;
        p.y += p.vy * s.speed * (1 + react * 3) * v.dt * 60 * 0.16;
        if (p.x < -8) p.x = st.w + 8; else if (p.x > st.w + 8) p.x = -8;
        if (p.y < -8) p.y = st.h + 8; else if (p.y > st.h + 8) p.y = -8;

        p.tw += v.dt * (2 + react * 6);
        const tw = 0.6 + 0.4 * Math.sin(p.tw);
        const rr = p.r * (1 + react * 2.4) * tw;
        const m = p.band / 63;
        ctx.fillStyle = mixA(m < 0.5 ? c0 : c1, m < 0.5 ? c1 : c2, m < 0.5 ? m * 2 : (m - 0.5) * 2, 0.35 + react * 0.6);
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, TAU); ctx.fill();
      }
      ctx.restore();
    },
  };

  /* ═══════════════════════════════════════════════════════════
     4 · RIBBON — oscilloscope ribbons with echo + mirror
     ═══════════════════════════════════════════════════════════ */
  const ribbon = {
    id: 'ribbon', label: 'Ribbon',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12c2.5-6 5-6 7.5 0s5 6 7.5 0 3.5-5 5-2"/></svg>',
    schema: [
      S.range('lines', 'Echo lines', 1, 5, 1, 3, (v) => String(v)),
      S.range('thick', 'Thickness', 1, 6, 0.5, 2.5, (v) => v.toFixed(1)),
      S.range('amp', 'Amplitude', 0.3, 1.6, 0.05, 1.15, pct),
      S.toggle('mirror', 'Mirror', true),
      S.toggle('fill', 'Fill glow', true),
    ],
    defaults() { return { lines: 3, thick: 2.5, amp: 1.15, mirror: true, fill: true }; },
    create() {
      return Object.assign(Object.create(this), { hist: [], sm: 0, smAmp: 1 });
    },
    resize() {},
    frame(v) {
      const { ctx, stage: st, palette } = v;
      const s = v.settings;
      const [c0, c1, c2] = palette.colors;
      const cy = st.y + st.h / 2;
      this.sm = vu(this.sm, v.energy, 0.5, 0.08);
      // Normalize against recent peak so quiet passages still read.
      let peak = 0.01;
      for (let i = 0; i < v.wave.length; i += 8) peak = Math.max(peak, Math.abs(v.wave[i]));
      this.smAmp = vu(this.smAmp, clamp(0.55 / peak, 0.7, 2.6), 0.25, 0.05);
      const ampMax = st.h * (s.mirror ? 0.42 : 0.8) * s.amp * this.smAmp;

      // Keep a short history of downsampled waves for echo lines.
      const NPTS = 160;
      const cur = new Float32Array(NPTS);
      const w = v.wave;
      for (let i = 0; i < NPTS; i++) cur[i] = w[(i / NPTS * w.length) | 0];
      this.hist.unshift(cur);
      const maxLines = 5;
      if (this.hist.length > maxLines) this.hist.length = maxLines;

      // Fill glow under the main line.
      if (s.fill) {
        const fg = ctx.createLinearGradient(0, cy - ampMax, 0, cy + (s.mirror ? ampMax : 0));
        fg.addColorStop(0, rgba(c1, 0));
        fg.addColorStop(0.5, rgba(c0, 0.10 + this.sm * 0.22));
        fg.addColorStop(1, rgba(c1, 0));
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(st.x, cy);
        for (let i = 0; i < NPTS; i++) {
          ctx.lineTo(st.x + (i / (NPTS - 1)) * st.w, cy + cur[i] * ampMax * (s.mirror ? 1 : 1));
        }
        ctx.lineTo(st.x + st.w, cy);
        if (s.mirror) {
          for (let i = NPTS - 1; i >= 0; i--) {
            ctx.lineTo(st.x + (i / (NPTS - 1)) * st.w, cy - cur[i] * ampMax);
          }
        }
        ctx.closePath(); ctx.fill();
      }

      const lines = clamp(Math.round(s.lines), 1, 5);
      for (let l = lines - 1; l >= 0; l--) {
        const wave = this.hist[l];
        if (!wave) continue;
        const fade = 1 - l / lines;
        const alpha = l === 0 ? 1 : 0.42 * fade;
        const grad = ctx.createLinearGradient(st.x, 0, st.x + st.w, 0);
        grad.addColorStop(0, mixA(c0, c1, 0.15, alpha));
        grad.addColorStop(0.35, mixA(c1, c2, 0.3, alpha));
        grad.addColorStop(0.65, mixA(c2, c1, 0.3, alpha));
        grad.addColorStop(1, mixA(c0, c1, 0.15, alpha));
        ctx.strokeStyle = grad;
        ctx.lineWidth = l === 0 ? s.thick : Math.max(1, s.thick * fade * 0.7);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const draw = (sign) => {
          ctx.beginPath();
          for (let i = 0; i < NPTS; i++) {
            const x = st.x + (i / (NPTS - 1)) * st.w;
            const y = cy + wave[i] * ampMax * sign;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        };
        draw(1);
        if (s.mirror) draw(-1);
      }

      // Center baseline shimmer.
      ctx.strokeStyle = rgba(c2, 0.10 + this.sm * 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(st.x, cy); ctx.lineTo(st.x + st.w, cy); ctx.stroke();
    },
  };

  /* ═══════════════════════════════════════════════════════════
     5 · BLOOM — pulsing concentric blobs
     ═══════════════════════════════════════════════════════════ */
  const bloom = {
    id: 'bloom', label: 'Bloom',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="7" opacity="0.6"/><circle cx="12" cy="12" r="10" opacity="0.3"/></svg>',
    schema: [
      S.range('rings', 'Rings', 2, 8, 1, 5, (v) => String(v)),
      S.range('wobble', 'Wobble', 0, 1, 0.05, 0.55, pct),
      S.toggle('spin', 'Spin', true),
      S.toggle('strobe', 'Kick flash', true),
    ],
    defaults() { return { rings: 5, wobble: 0.55, spin: true, strobe: true }; },
    create() {
      return Object.assign(Object.create(this), {
        sm: new Float32Array(64), rot: 0, flash: 0,
      });
    },
    resize() {},
    frame(v) {
      const { ctx, stage: st, palette } = v;
      const s = v.settings;
      const [c0, c1, c2] = palette.colors;
      const vals = sampleBands(v, 48, this.sm);
      const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
      const maxR = Math.min(st.w, st.h) * 0.46;
      const nRings = clamp(Math.round(s.rings), 2, 8);
      if (s.spin) this.rot += v.dt * (0.1 + v.energy * 0.6);
      this.flash = Math.max(this.flash * Math.pow(0.02, v.dt), v.kick * (s.strobe ? 1.6 : 0));

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Full-stage kick flash.
      if (this.flash > 0.01) {
        ctx.fillStyle = rgba(c2, this.flash * 0.05);
        ctx.fillRect(st.x, st.y, st.w, st.h);
      }

      for (let r = nRings; r >= 1; r--) {
        const rm = r / nRings;
        const ringR = maxR * rm * (1 + v.bass * 0.1 * (1 - rm) + this.flash * 0.06);
        ctx.beginPath();
        const SEG = 48;
        for (let i = 0; i <= SEG; i++) {
          const a = this.rot * (r % 2 ? 1 : -1) * (0.4 + rm) + (i / SEG) * TAU;
          const band = vals[i % SEG];
          const wob = 1 + band * s.wobble * (0.4 + 0.6 * (1 - rm)) + Math.sin(a * 3 + v.t * 1.4 + r) * 0.03 * s.wobble;
          const rr = ringR * wob;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const alpha = 0.22 + 0.5 * (1 - rm) + this.flash * 0.2;
        const cA = mix(c0, c1, rm), cB = mix(c1, c2, rm);
        ctx.strokeStyle = mixA(cA, cB, vals[(r * 7) % 48], clamp(alpha, 0, 1));
        ctx.lineWidth = 1.2 + (1 - rm) * 2.2;
        ctx.stroke();
        ctx.fillStyle = mixA(cA, cB, 0.5, 0.03 + v.energy * 0.05 * (1 - rm));
        ctx.fill();
      }

      // Core orb.
      const coreR = maxR * 0.12 * (1 + v.bass * 0.5 + this.flash * 0.35);
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.6);
      cg.addColorStop(0, rgba(c2, 0.75));
      cg.addColorStop(0.35, rgba(c1, 0.28));
      cg.addColorStop(1, rgba(c0, 0));
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, coreR * 2.6, 0, TAU); ctx.fill();
      ctx.restore();
    },
  };

  /* ═══════════════════════════════════════════════════════════
     6 · MATRIX — spectrum grid / equalizer wall
     ═══════════════════════════════════════════════════════════ */
  const matrix = {
    id: 'matrix', label: 'Matrix',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="4" height="4" rx="1"/><rect x="10" y="3" width="4" height="4" rx="1"/><rect x="17" y="3" width="4" height="4" rx="1"/><rect x="3" y="10" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1"/><rect x="17" y="10" width="4" height="4" rx="1"/><rect x="3" y="17" width="4" height="4" rx="1"/><rect x="10" y="17" width="4" height="4" rx="1"/><rect x="17" y="17" width="4" height="4" rx="1"/></svg>',
    schema: [
      S.range('cols', 'Columns', 12, 48, 1, 0, (v) => v === 0 ? 'Auto' : String(v)),
      S.range('rows', 'Rows', 6, 20, 1, 12, (v) => String(v)),
      S.toggle('fall', 'Falling caps', true),
      S.range('round', 'Roundness', 0, 1, 0.05, 0.5, pct),
    ],
    defaults() { return { cols: 0, rows: 12, fall: true, round: 0.5 }; },
    create() {
      return Object.assign(Object.create(this), {
        sm: new Float32Array(48), caps: new Float32Array(48),
      });
    },
    resize() {},
    frame(v) {
      const { ctx, stage: st, palette } = v;
      const s = v.settings;
      const [c0, c1, c2] = palette.colors;
      const cols = s.cols > 0 ? Math.round(s.cols) : clamp(Math.round(st.w / 30), 12, 40);
      const rows = clamp(Math.round(s.rows), 6, 20);
      const vals = sampleBands(v, cols, this.sm);

      const gap = Math.max(2, Math.min(st.w, st.h) * 0.006);
      const cw = (st.w - gap * (cols - 1)) / cols;
      const ch = (st.h * 0.9 - gap * (rows - 1)) / rows;
      const x0 = st.x, y0 = st.y + st.h * 0.95;
      const rad = Math.min(cw, ch) * 0.5 * s.round;

      // Background grid ghost.
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          ctx.beginPath();
          ctx.roundRect(x0 + c * (cw + gap), y0 - (r + 1) * (ch + gap) + gap, cw, ch, rad);
          ctx.fill();
        }
      }

      for (let c = 0; c < cols; c++) {
        const level = vals[c] * rows;
        const lit = Math.floor(level);
        const frac = level - lit;
        for (let r = 0; r < rows; r++) {
          if (r > lit) break;
          const m = r / rows;
          const on = r < lit ? 1 : frac;
          const col = m > 0.78 ? mix(c1, c2, (m - 0.78) / 0.22) : mix(c0, c1, m / 0.78);
          ctx.fillStyle = rgba(col, 0.16 + on * 0.8);
          ctx.beginPath();
          ctx.roundRect(x0 + c * (cw + gap), y0 - (r + 1) * (ch + gap) + gap, cw, ch, rad);
          ctx.fill();
        }
        // Falling cap.
        if (s.fall) {
          this.caps[c] = Math.max(this.caps[c] - rows * v.dt * 0.55, level);
          const capR = Math.min(this.caps[c], rows - 0.01);
          const cr = Math.floor(capR);
          if (capR > 0.3) {
            ctx.fillStyle = rgba(c2, 0.55 + 0.3 * (capR - cr));
            ctx.beginPath();
            ctx.roundRect(x0 + c * (cw + gap), y0 - (cr + 1) * (ch + gap) + gap, cw, ch, rad);
            ctx.fill();
          }
        }
      }
    },
  };

  /* ── Registry ──────────────────────────────────────────────── */
  const MODES = {};
  [spectra, halo, drift, ribbon, bloom, matrix].forEach((m) => { MODES[m.id] = m; });

  K3.PALETTES = PALETTES;
  K3.MODES = MODES;
  K3.MODE_ORDER = ['spectra', 'halo', 'drift', 'ribbon', 'bloom', 'matrix'];
  K3.modeDefaults = (id) => MODES[id].defaults();
  K3.vizUtil = { vu, clamp, lerp, rgba, mix, mixA, TAU };

})();
