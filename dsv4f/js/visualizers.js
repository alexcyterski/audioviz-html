// Visualizer modes + color palettes.
// Each mode is a factory: create() => instance (inherits frame/resize via prototype).
// view = { ctx, w, h, dpr, t, dt, bands[64], waveNorm[], energy, bass, mid, treb, kick,
//          settings:{sens,mirror,detail}, palette, drawVignette(alpha) }

export const PALETTES = {
  neon:   { bg: [5, 6, 10],   colors: [[255, 45, 120], [122, 45, 255], [0, 217, 255]], name: 'Neon' },
  sunset: { bg: [10, 5, 8],   colors: [[255, 107, 53], [255, 46, 99], [249, 199, 79]], name: 'Sunset' },
  ocean:  { bg: [2, 6, 13],   colors: [[0, 245, 212], [0, 187, 249], [67, 97, 238]],   name: 'Ocean' },
  aurora: { bg: [4, 12, 10],  colors: [[105, 240, 174], [64, 196, 255], [179, 136, 255]], name: 'Aurora' },
  mono:   { bg: [4, 4, 6],    colors: [[255, 255, 255], [120, 220, 255], [255, 120, 180]], name: 'Mono' },
};

/* ---------- color / math helpers ---------- */

function css(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }
function cssA(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
function mix(c1, c2, f) {
  return [c1[0] + (c2[0] - c1[0]) * f, c1[1] + (c2[1] - c1[1]) * f, c1[2] + (c2[2] - c1[2]) * f];
}
function palAt(pal, t) {
  const cs = pal.colors;
  if (cs.length === 1) return cs[0];
  const x = Math.min(0.999, Math.max(0, t)) * (cs.length - 1);
  const i = Math.floor(x);
  return mix(cs[i], cs[i + 1], x - i);
}
/** VU-style smoothing: fast attack, slow release — the "premium" motion feel. */
function smoothAR(arr, i, target, attack, release) {
  const s = arr[i];
  const v = target > s ? s + (target - s) * attack : s + (target - s) * release;
  arr[i] = v;
  return v;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function trace(ctx, xs, ys) {
  ctx.beginPath();
  ctx.moveTo(xs[0], ys[0]);
  for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
}

/* ---------- 1. Spectrum: wide gradient bars, mirrored, glowing peaks ---------- */

const spectrum = {
  id: 'spectrum', label: 'Spectrum', icon: '▂',
  create() {
    return Object.assign(Object.create(this), {
      n: 40,
      smooth: new Float32Array(64),
      peaks: new Float32Array(64),
      grid: [],
    });
  },
  resize(v) {
    // fewer, wider bars on phones; cap on desktops
    this.n = Math.max(20, Math.min(56, Math.round(v.w / 16)));
    const grid = [];
    const step = Math.max(44, Math.round(v.h / 7));
    for (let y = (v.h % step) / 2; y < v.h; y += step) grid.push(y);
    this.grid = grid;
  },
  frame(v) {
    const { ctx, w, h } = v;
    const n = this.n;
    ctx.fillStyle = cssA(v.palette.bg, 1);
    ctx.fillRect(0, 0, w, h);
    v.drawVignette(0.55);

    // subtle horizontal grid for depth
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (const y of this.grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const st = v.stage;
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    const scale = st.h * 0.38;
    const bw = w / (n * 2);
    const barW = Math.max(3, bw - Math.max(2, bw * 0.16));
    const tCol = v.t * 0.02; // slow palette drift

    // attack / release smoothing + falling peaks
    for (let i = 0; i < n; i++) {
      smoothAR(this.smooth, i, v.bands[i], 0.72, 0.09);
      if (this.smooth[i] > this.peaks[i]) this.peaks[i] = this.smooth[i];
      else this.peaks[i] = Math.max(0, this.peaks[i] - v.dt * 0.7);
    }

    // center axis
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(cx - 0.5, 0, 1, h);

    for (let i = 0; i < n; i++) {
      const val = this.smooth[i];
      const bh = Math.max(4, val * scale);
      const xr = cx + i * bw + (bw - barW) / 2;
      const xl = cx - (i + 1) * bw + (bw - barW) / 2;
      const y = cy - bh / 2;
      const col = palAt(v.palette, (i / (n - 1) + tCol) % 1);

      // vertical gradient: bright tip → deep base
      const g = ctx.createLinearGradient(0, y, 0, y + bh);
      g.addColorStop(0, cssA(mix(col, [255, 255, 255], 0.35), 1));
      g.addColorStop(0.35, css(col));
      g.addColorStop(1, cssA(col, 0.15));
      ctx.fillStyle = g;
      const r = Math.min(6, barW / 2);
      ctx.beginPath();
      ctx.roundRect(xr, y, barW, bh, r);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(xl, y, barW, bh, r);
      ctx.fill();

      // additive glow around each bar
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = cssA(col, 0.18);
      ctx.beginPath();
      ctx.roundRect(xr - 1.5, y - 1.5, barW + 3, bh + 3, r + 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(xl - 1.5, y - 1.5, barW + 3, bh + 3, r + 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      // falling peak marker (small diamond)
      const py = cy - this.peaks[i] * scale;
      if (py > 3) {
        const mcx = xr + barW / 2;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        const d = 3;
        ctx.beginPath();
        ctx.moveTo(mcx, py - d);
        ctx.lineTo(mcx + d, py);
        ctx.lineTo(mcx, py + d);
        ctx.lineTo(mcx - d, py);
        ctx.closePath();
        ctx.fill();
        const mlx = xl + barW / 2;
        ctx.beginPath();
        ctx.moveTo(mlx, py - d);
        ctx.lineTo(mlx + d, py);
        ctx.lineTo(mlx, py + d);
        ctx.lineTo(mlx - d, py);
        ctx.closePath();
        ctx.fill();
      }
    }

    // energy bloom
    if (v.energy > 0.25) {
      const r = h * 0.6 * v.energy;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, cssA(palAt(v.palette, 0.5), 0.08 * v.energy));
      g.addColorStop(1, cssA(v.palette.bg, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  },
};

/* ---------- 2. Orbit: rotating radial spectrum, glowing bars + tip dots ---------- */

const orbit = {
  id: 'orbit', label: 'Orbit', icon: '◎',
  create() {
    return Object.assign(Object.create(this), { rot: 0, smooth: new Float32Array(48) });
  },
  frame(v) {
    const { ctx, w, h } = v;
    const st = v.stage;
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    const n = 48;
    const baseR = Math.min(st.w, st.h) * 0.24;
    const maxR = Math.min(st.w, st.h) * 0.44;
    const mirror = v.settings.mirror;

    ctx.fillStyle = cssA(v.palette.bg, 1);
    ctx.fillRect(0, 0, w, h);
    v.drawVignette(0.6);

    this.rot += v.dt * (0.25 + v.bass * 0.9);
    const band = (i) => smoothAR(this.smooth, i, Math.min(1, v.bands[(i * 64 / n) | 0]), 0.7, 0.12);

    // static rings: base + faint outer guide
    ctx.strokeStyle = cssA(palAt(v.palette, 0.5), 0.14);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = cssA(palAt(v.palette, 0.8), 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 1.03, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineCap = 'round';
    const drawBars = (offset) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + this.rot + offset;
        const len = baseR + band(i) * (maxR - baseR);
        const dx = Math.cos(a), dy = Math.sin(a);
        const sx = cx + dx * baseR, sy = cy + dy * baseR;
        const ex = cx + dx * len, ey = cy + dy * len;
        const col = palAt(v.palette, i / n);
        // glow pass
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = cssA(col, 0.15);
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        // core pass
        ctx.strokeStyle = css(col);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        // glowing tip dot
        ctx.fillStyle = cssA(mix(col, [255, 255, 255], 0.4), 0.9);
        ctx.beginPath();
        ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    drawBars(0);
    if (mirror) drawBars(Math.PI);

    // spirograph tip ring
    ctx.strokeStyle = cssA(palAt(v.palette, 0.66), 0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2 + this.rot;
      const len = baseR + band(i) * (maxR - baseR);
      const x = cx + Math.cos(a) * len;
      const y = cy + Math.sin(a) * len;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    // pulsing core
    const coreR = 4 + v.energy * 20;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3);
    g.addColorStop(0, cssA(palAt(v.palette, 0.5), 0.85));
    g.addColorStop(1, cssA(palAt(v.palette, 0.5), 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
};

/* ---------- 3. Nebula: comet-streak particle cloud with kick bursts ---------- */

const nebula = {
  id: 'nebula', label: 'Nebula', icon: '✦',
  create() {
    return Object.assign(Object.create(this), { parts: [], stars: [], rot: 0, burstT: 0, _dim: 0 });
  },
  resize(v) {
    const count = Math.max(60, Math.round(260 * v.settings.detail));
    const dim = Math.min(v.stage.w, v.stage.h);
    const rng = mulberry32(1337);
    this.stars = [];
    for (let i = 0; i < 60; i++) {
      this.stars.push({ x: rng() * v.w, y: rng() * v.h, r: rng() * 1.1 + 0.3, a: rng() * 0.22 + 0.05 });
    }
    // re-home existing particles proportionally when the canvas size changed
    if (this._dim && dim !== this._dim) {
      const scale = dim / this._dim;
      for (const p of this.parts) {
        p.home *= scale;
        p.r *= scale;
        p.px = p.py = 0;
      }
    }
    this._dim = dim;
    if (this.parts.length !== count) {
      this.parts = [];
      for (let i = 0; i < count; i++) {
        const home = dim * (0.08 + Math.random() * 0.3);
        this.parts.push({
          ang: Math.random() * Math.PI * 2,
          home,
          r: Math.random() * dim * 0.42,
          spd: (Math.random() * 0.5 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
          size: Math.random() * 2.2 + 0.6,
          hue: Math.random(),
          px: 0, py: 0,
        });
      }
    }
  },
  frame(v) {
    const { ctx, w, h } = v;
    const st = v.stage;
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    const parts = this.parts;

    // trail fade
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = cssA(v.palette.bg, 0.2);
    ctx.fillRect(0, 0, w, h);

    // faint static stars
    ctx.fillStyle = '#fff';
    for (const s of this.stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    this.rot += v.dt * (0.03 + v.treb * 0.35);
    if (v.kick > 0.18) this.burstT = 1;

    const maxD = Math.min(st.w, st.h) * 0.5;
    const pushR = v.bass * maxD * 0.5;
    const nP = parts.length;
    ctx.globalCompositeOperation = 'lighter';
    const streakA = 0.35 + v.energy * 0.35;
    for (let i = 0; i < nP; i++) {
      const p = parts[i];
      p.ang += p.spd * v.dt * (1 + v.treb * 1.5);
      p.r += (p.home + pushR - p.r) * 0.055;
      if (this.burstT > 0) p.r += this.burstT * 40 * v.dt;
      const a = p.ang + this.rot;
      const x = cx + Math.cos(a) * p.r;
      const y = cy + Math.sin(a) * p.r;
      const t = (p.hue * 0.5 + (p.r / maxD) * 0.5) % 1;
      const col = palAt(v.palette, t);
      // comet streak from previous position
      if (p.px || p.py) {
        ctx.strokeStyle = cssA(col, streakA);
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(x, y);
        ctx.stroke();
      }
      // bright head
      ctx.fillStyle = cssA(mix(col, [255, 255, 255], 0.35), 0.95);
      ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
      p.px = x;
      p.py = y;
    }
    this.burstT = Math.max(0, this.burstT - v.dt * 1.4);

    // center glow
    const gr = maxD * 0.56;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    g.addColorStop(0, cssA(palAt(v.palette, 0.5), 0.1 + v.energy * 0.14));
    g.addColorStop(1, cssA(v.palette.bg, 0));
    ctx.fillStyle = g;
    ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);
    ctx.globalCompositeOperation = 'source-over';
  },
};

/* ---------- 4. Wave: glowing ribbon with echo line and peak dot ---------- */

const wave = {
  id: 'wave', label: 'Wave', icon: '∿',
  create() {
    return Object.assign(Object.create(this), { amp: 0.5, n: 240 });
  },
  frame(v) {
    const { ctx, w, h } = v;
    const st = v.stage;
    const n = this.n;
    const cy = st.y + st.h * 0.5;

    ctx.fillStyle = cssA(v.palette.bg, 1);
    ctx.fillRect(0, 0, w, h);
    v.drawVignette(0.55);

    const target = Math.max(0.15, v.energy * 1.35);
    this.amp += (target - this.amp) * 0.15;
    const amp = this.amp * st.h * 0.4 * v.settings.sens;

    const wf = v.waveNorm;
    const step = Math.max(1, Math.floor(wf.length / n));
    const xs = new Array(n);
    const ys = new Array(n);
    let maxI = 0, maxDev = -1;
    for (let i = 0; i < n; i++) {
      xs[i] = (i / (n - 1)) * w;
      const dev = wf[Math.min(wf.length - 1, i * step)];
      if (Math.abs(dev) > maxDev) {
        maxDev = Math.abs(dev);
        maxI = i;
      }
      ys[i] = cy + dev * amp;
    }

    const gH = ctx.createLinearGradient(0, 0, w, 0);
    gH.addColorStop(0, cssA(palAt(v.palette, 0), 0.3));
    gH.addColorStop(0.5, cssA(palAt(v.palette, 0.5), 0.5));
    gH.addColorStop(1, cssA(palAt(v.palette, 1), 0.3));
    const gCore = ctx.createLinearGradient(0, 0, w, 0);
    gCore.addColorStop(0, css(palAt(v.palette, 0)));
    gCore.addColorStop(0.5, css(palAt(v.palette, 0.5)));
    gCore.addColorStop(1, css(palAt(v.palette, 1)));

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // soft fill under the curve
    const gV = ctx.createLinearGradient(0, cy - amp, 0, h);
    gV.addColorStop(0, cssA(palAt(v.palette, 0.5), 0.16));
    gV.addColorStop(1, cssA(v.palette.bg, 0));
    ctx.fillStyle = gV;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (i === 0) ctx.moveTo(xs[i], ys[i]);
      else ctx.lineTo(xs[i], ys[i]);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();

    // echo line (offset ghost, adds ribbon depth)
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    ctx.strokeStyle = gH;
    trace(ctx, xs, ys.map((y) => y + 14));
    ctx.stroke();
    ctx.globalAlpha = 1;

    // glow pass
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 10;
    ctx.strokeStyle = gH;
    trace(ctx, xs, ys);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // core pass
    ctx.lineWidth = 3;
    ctx.strokeStyle = gCore;
    trace(ctx, xs, ys);
    ctx.stroke();

    // faint reflection
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = gCore;
    trace(ctx, xs, ys.map((y) => cy - (y - cy)));
    ctx.stroke();
    ctx.globalAlpha = 1;

    // glowing peak dot
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = cssA(palAt(v.palette, 0.5), 0.55);
    ctx.beginPath();
    ctx.arc(xs[maxI], ys[maxI], 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // center axis
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(0, cy - 0.5, w, 1);
  },
};

/* ---------- 5. Pulse: breathing rings, dual-pass glow, kick flash ---------- */

const pulse = {
  id: 'pulse', label: 'Pulse', icon: '◉',
  create() {
    return Object.assign(Object.create(this), {
      rings: 4,
      smooth: new Float32Array(4),
      flash: 0,
    });
  },
  frame(v) {
    const { ctx, w, h } = v;
    const st = v.stage;
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2;
    const base = Math.min(st.w, st.h) * 0.2;
    const span = Math.min(st.w, st.h) * 0.4;
    const regions = [[0, 10], [10, 22], [22, 40], [40, 64]];

    ctx.fillStyle = cssA(v.palette.bg, 1);
    ctx.fillRect(0, 0, w, h);
    v.drawVignette(0.55);

    // faint static guide rings for depth
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(cx, cy, base * k + span * 0.28, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let r = 0; r < this.rings; r++) {
      const [s, e] = regions[r];
      let acc = 0;
      for (let i = s; i < e; i++) acc += v.bands[i];
      const b = acc / (e - s);
      const sm = smoothAR(this.smooth, r, b, 0.6, 0.12);
      const rad = base * (r + 1) + sm * span;
      const col = palAt(v.palette, r / 3);

      // glow pass
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = cssA(col, 0.13);
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';

      // core ring
      ctx.strokeStyle = cssA(col, 0.65);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.stroke();

      // orbiting satellite with halo
      const a = v.t * 0.8 + r * 1.7 + v.bands[Math.min(63, r * 20)] * 6;
      const dx = Math.cos(a), dy = Math.sin(a);
      const sx = cx + dx * rad, sy = cy + dy * rad;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = cssA(col, 0.25);
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = css(mix(col, [255, 255, 255], 0.4));
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // kick flash ring
    if (v.kick > 0.15) this.flash = Math.max(this.flash, v.kick);
    this.flash *= Math.pow(0.001, v.dt);
    if (this.flash > 0.01) {
      const fr = Math.min(st.w, st.h) * 0.45 * (1 - this.flash);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = cssA(palAt(v.palette, 0.5), this.flash * 0.6);
      ctx.lineWidth = 2 + this.flash * 6;
      ctx.beginPath();
      ctx.arc(cx, cy, fr + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // center glow
    ctx.globalCompositeOperation = 'lighter';
    const gr = base * 0.8;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    g.addColorStop(0, cssA(palAt(v.palette, 0.5), 0.35 + v.energy * 0.4));
    g.addColorStop(1, cssA(v.palette.bg, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, gr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  },
};

/* ---------- registry ---------- */

export const MODES = { spectrum, orbit, nebula, wave, pulse };
export const MODE_LIST = [spectrum, orbit, nebula, wave, pulse];
