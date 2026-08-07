/* ═══════════════════════════════════════════════════════════════
   Kimi K3 — generative demo tracks
   Lookahead step-sequencer + Web Audio sound blocks.
   No audio files: everything is synthesized live so the analyser
   always has real frequency content (and CORS can never bite).
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.K3 = window.K3 || {};

(function () {

  /* ── Lookahead step sequencer ─────────────────────────────────
     One 30ms interval schedules everything inside a 120ms window
     against ctx.currentTime. Never setTimeout chains — they drift. */
  function sequencer(ctx, bpm, steps, onStep) {
    let timer = null, step = 0, next = 0;
    const stepDur = 60 / bpm / 4; // 16th notes
    return {
      start(t0) {
        next = t0 + 0.06;
        step = 0;
        timer = setInterval(() => {
          // If the tab was backgrounded and timers throttled, resync.
          if (next < ctx.currentTime - 0.25) next = ctx.currentTime + 0.05;
          while (next < ctx.currentTime + 0.12) {
            onStep(next, step);
            step = (step + 1) % steps;
            next += stepDur;
          }
        }, 30);
      },
      stop() { if (timer) clearInterval(timer); timer = null; },
    };
  }

  /* ── Shared noise buffer (one per context) ─────────────────── */
  function noiseBuffer(ctx) {
    if (ctx.__k3noise) return ctx.__k3noise;
    const len = ctx.sampleRate * 1.2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    ctx.__k3noise = buf;
    return buf;
  }

  /* ── Sound blocks: all take (ctx, t, out, …) and self-stop ── */

  function kick(ctx, t, out, vol = 0.95) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.3);
  }

  function clap(ctx, t, out, vol = 0.32, freq = 1800) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.2);
  }

  function hat(ctx, t, out, vol = 0.09, open = false) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx);
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = open ? 6200 : 8200;
    const g = ctx.createGain();
    const dur = open ? 0.24 : 0.045;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  function bassSaw(ctx, t, out, freq, dur = 0.22, cutoff = 620, vol = 0.4) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function subBass(ctx, t, out, freq, dur = 0.9, vol = 0.34) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function pluck(ctx, t, out, freq, vol = 0.09, type = 'triangle', dur = 0.16) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.03);
  }

  function pad(ctx, t, out, freqs, dur = 0.9, cutoff = 1150, vol = 0.12) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g); g.connect(out);
    freqs.forEach((fr, i) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.detune.value = i % 2 ? 5 : -5;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.03);
    });
  }

  function acid(ctx, t, out, freq = 110, vol = 0.14) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq;
    f.type = 'bandpass'; f.Q.value = 12;
    f.frequency.setValueAtTime(420, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    o.connect(f); f.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.3);
  }

  function warmChord(ctx, t, out, freqs, dur = 0.85, vol = 0.11) {
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 1200;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    f.connect(g); g.connect(out);
    freqs.forEach((fr) => {
      [-3.5, 3.5].forEach((det) => {
        const o = ctx.createOscillator();
        o.type = 'sine'; o.frequency.value = fr; o.detune.value = det;
        o.connect(f);
        o.start(t); o.stop(t + dur + 0.03);
      });
    });
  }

  /* Note helper: midi → Hz */
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);

  /* ── Track recipes (32-step loops = 2 bars of 4/4) ─────────── */

  // 1 · Neon Circuit — synthwave, 112 bpm
  function neonCircuit(ctx, out) {
    const seq = sequencer(ctx, 112, 32, (t, s) => {
      const beat = s % 16;
      if (beat === 0 || beat === 8) kick(ctx, t, out);
      if (beat === 4 || beat === 12) clap(ctx, t, out);
      if (s % 2 === 0) hat(ctx, t, out, s % 8 === 6 ? 0.14 : 0.08);

      // Pulsing octave bass: root on even 8ths, octave up on odd.
      const roots = [N(33), N(29), N(36), N(31)]; // A1 F1 C2 G1
      const root = roots[(s >> 3) % 4];
      if (s % 2 === 0) bassSaw(ctx, t, out, s % 4 === 0 ? root : root * 2, 0.2);

      // 16th arp over A minor pentatonic, quiet triangle.
      const penta = [N(69), N(72), N(74), N(76), N(79), N(81)];
      if (s % 2 === 1) pluck(ctx, t, out, penta[(s * 7 + (s >> 4) * 3) % penta.length], 0.055);

      // Pad chord every 2 beats.
      const chords = [
        [N(57), N(60), N(64)], [N(53), N(57), N(60)],
        [N(60), N(64), N(67)], [N(55), N(59), N(62)],
      ];
      if (s % 8 === 0) pad(ctx, t, out, chords[(s >> 3) % 4], 1.7);
    });
    return { start() { seq.start(ctx.currentTime + 0.08); }, stop() { seq.stop(); } };
  }

  // 2 · Midnight Lo-Fi — 78 bpm, warm chords + vinyl bed
  function midnightLofi(ctx, out) {
    // Vinyl noise bed — a looped source, so keep refs to stop it.
    const bedSrc = ctx.createBufferSource(); bedSrc.buffer = noiseBuffer(ctx); bedSrc.loop = true;
    const bedF = ctx.createBiquadFilter(); bedF.type = 'lowpass'; bedF.frequency.value = 1600;
    const bedG = ctx.createGain(); bedG.gain.value = 0.007;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.4;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.003;
    lfo.connect(lfoG); lfoG.connect(bedG.gain);
    bedSrc.connect(bedF); bedF.connect(bedG); bedG.connect(out);

    const seq = sequencer(ctx, 78, 32, (t, s) => {
      const beat = s % 16;
      if (beat === 0 || beat === 8) kick(ctx, t, out, 0.85);
      if (beat === 4 || beat === 12) clap(ctx, t, out, 0.22, 1500);
      if (s % 2 === 0) hat(ctx, t, out, 0.05);
      if (beat === 14) hat(ctx, t, out, 0.07, true);

      // Cmaj7 / Am7 / Fmaj7 / G7 stabs every 2 beats.
      const chords = [
        [N(60), N(64), N(67), N(71)], [N(57), N(60), N(64), N(67)],
        [N(53), N(57), N(60), N(64)], [N(55), N(59), N(62), N(65)],
      ];
      if (s % 8 === 2) warmChord(ctx, t, out, chords[(s >> 3) % 4]);

      // Sub bass on roots.
      const roots = [N(36), N(33), N(29), N(31)]; // C2 A1 F1 G1
      if (beat === 0) subBass(ctx, t, out, roots[(s >> 4) % 4], 1.6);
    });

    return {
      start() {
        const t0 = ctx.currentTime + 0.08;
        bedSrc.start(t0); lfo.start(t0);
        seq.start(t0);
      },
      stop() {
        seq.stop();
        try { bedSrc.stop(); lfo.stop(); } catch (e) { /* already stopped */ }
      },
    };
  }

  // 3 · Pulse Drive — techno, 128 bpm
  function pulseDrive(ctx, out) {
    const seq = sequencer(ctx, 128, 32, (t, s) => {
      const beat = s % 16;
      if (s % 4 === 0) kick(ctx, t, out, 1.0);               // four on the floor
      if (s % 4 === 2) hat(ctx, t, out, 0.11, beat % 8 === 6); // offbeat hats
      else if (s % 2 === 0) hat(ctx, t, out, 0.05);

      // Offbeat saw bass stab.
      if (s % 4 === 2) {
        const roots = [N(33), N(33), N(36), N(31)];
        bassSaw(ctx, t, out, roots[(s >> 3) % 4], 0.16, 380, 0.36);
      }

      // Acid squelch on beats 2 & 4.
      if (beat === 4 || beat === 12) acid(ctx, t, out, beat === 4 ? N(45) : N(43));

      // Pad stab at the top of each bar.
      const chords = [[N(57), N(60), N(64)], [N(55), N(58), N(62)]];
      if (beat === 0) pad(ctx, t, out, chords[(s >> 4) % 2], 1.4, 900, 0.1);
    });
    return { start() { seq.start(ctx.currentTime + 0.08); }, stop() { seq.stop(); } };
  }

  /* ── Registry ──────────────────────────────────────────────── */
  K3.tracks = [
    { id: 'neon',    label: 'Neon Circuit',  sub: 'Synthwave · 112', create: neonCircuit },
    { id: 'lofi',    label: 'Midnight Lo-Fi', sub: 'Lo-Fi · 78',      create: midnightLofi },
    { id: 'pulse',   label: 'Pulse Drive',   sub: 'Techno · 128',    create: pulseDrive },
  ];

})();
