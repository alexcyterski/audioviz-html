// Generative demo tracks — pure Web Audio synthesis, zero audio files.
// Each track is a factory: (ctx, out) => ({ start(), stop() })
// A lookahead step-sequencer schedules 16th notes against AudioContext time.

function getNoise(ctx) {
  if (!ctx._waveformNoise) {
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx._waveformNoise = buf;
  }
  return ctx._waveformNoise;
}

function sequencer(ctx, bpm, steps, onStep) {
  let timer = null, step = 0, next = 0;
  const stepDur = 60 / bpm / 4;
  return {
    start(t0) {
      next = t0 + 0.06;
      step = 0;
      timer = setInterval(() => {
        while (next < ctx.currentTime + 0.12) {
          onStep(next, step);
          step = (step + 1) % steps;
          next += stepDur;
        }
      }, 30);
    },
    stop() {
      clearInterval(timer);
      timer = null;
    },
  };
}

/* ---------- Sound building blocks ---------- */

function kick(ctx, t, out, vol = 1) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.3);
}

function clap(ctx, t, out, vol = 0.35) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1800;
  f.Q.value = 0.9;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.2);
}

function softSnare(ctx, t, out, vol = 0.24) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1500;
  f.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + 0.25);
}

function hat(ctx, t, out, vol = 0.12, open = false) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = open ? 6000 : 8000;
  const g = ctx.createGain();
  const dur = open ? 0.24 : 0.045;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function sawBass(ctx, t, out, freq, dur = 0.14, vol = 0.4, cutoff = 640) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  f.Q.value = 6;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function triNote(ctx, t, out, freq, dur = 0.12, vol = 0.06) {
  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function subBass(ctx, t, out, freq, dur, vol = 0.3) {
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.04);
  g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.1));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.1);
}

function warmChord(ctx, t, out, freqs, dur, vol = 0.09, cutoff = 1200) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.06);
  g.gain.setValueAtTime(vol, t + Math.max(0.05, dur - 0.2));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const oscs = [];
  for (const fr of freqs) {
    for (const det of [-3.5, 3.5]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = fr;
      o.detune.value = det;
      o.connect(f);
      oscs.push(o);
    }
  }
  f.connect(g).connect(out);
  for (const o of oscs) {
    o.start(t);
    o.stop(t + dur + 0.1);
  }
}

function padChord(ctx, t, out, freqs, dur, vol = 0.13, cutoff = 1400) {
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  f.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.5, dur * 0.25));
  g.gain.setValueAtTime(vol, t + Math.max(0.1, dur - 0.2));
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  const oscs = freqs.map((fr) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = fr;
    o.detune.value = Math.random() * 10 - 5;
    o.connect(f);
    return o;
  });
  f.connect(g).connect(out);
  for (const o of oscs) {
    o.start(t);
    o.stop(t + dur + 0.05);
  }
}

function acidNote(ctx, t, out, freq, vol = 0.26) {
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.value = freq;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 12;
  f.frequency.setValueAtTime(420, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o.connect(f).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.32);
}

/* ---------- Tracks ---------- */

export const TRACKS = [
  {
    id: 'neon',
    name: 'Neon Drive',
    make(ctx, out) {
      const bpm = 112;
      const roots = [55.0, 43.65, 65.41, 49.0];   // A1 F1 C2 G1
      const arp = [220, 261.63, 329.63, 440, 523.25, 440, 329.63, 261.63]; // Am pentatonic
      const pads = [
        [110, 164.81, 220],      // Am
        [87.31, 130.81, 174.61], // F
        [130.81, 196, 261.63],   // C
        [98, 146.83, 196],       // G
      ];
      let seq = null;
      const onStep = (t, s) => {
        const s8 = s >> 1;              // 8th-note index
        const group = (s8 >> 2) % 4;    // chord/root changes every 2 beats
        // drums
        if (s % 16 === 0 || s % 16 === 8) kick(ctx, t, out, 0.9);
        if (s % 16 === 4 || s % 16 === 12) clap(ctx, t, out, 0.3);
        if (s % 2 === 0) hat(ctx, t, out, s % 8 === 6 ? 0.22 : 0.1);
        // pulsing octave bass
        if (s % 2 === 0) sawBass(ctx, t, out, s8 % 2 === 0 ? roots[group] : roots[group] * 2, 0.17, 0.42, 620);
        // 16th arp sparkle
        triNote(ctx, t, out, arp[s % 8], 0.11, s % 8 === 0 ? 0.07 : 0.045);
        // pad wash each 2 beats
        if (s % 8 === 0) padChord(ctx, t, out, pads[group], (8 * 60 / bpm / 4) * 1.05, 0.12, 1300);
      };
      return {
        start() { seq = sequencer(ctx, bpm, 32, onStep); seq.start(ctx.currentTime + 0.08); },
        stop() { if (seq) { seq.stop(); seq = null; } },
      };
    },
  },

  {
    id: 'lofi',
    name: 'Lo-Fi Dream',
    make(ctx, out) {
      const bpm = 78;
      const chords = [
        [261.63, 329.63, 392, 493.88], // Cmaj7
        [220, 261.63, 329.63, 392],     // Am7
        [174.61, 220, 261.63, 329.63],  // Fmaj7
        [196, 246.94, 293.66, 349.23],  // G7
      ];
      const bassRoots = [65.41, 55, 43.65, 49]; // C2 A1 F1 G1
      let seq = null;
      let vinyl = null;
      const onStep = (t, s) => {
        const group = (s >> 3) % 4; // chord every 2 beats
        // drums
        if (s % 16 === 0 || s % 16 === 8) kick(ctx, t, out, 0.75);
        if (s % 16 === 4 || s % 16 === 12) softSnare(ctx, t, out, 0.22);
        if (s % 2 === 0) hat(ctx, t, out, 0.06);
        if (s % 16 === 14) hat(ctx, t, out, 0.1, true);
        // warm chord stabs
        if (s % 8 === 0) warmChord(ctx, t, out, chords[group], (8 * 60 / bpm / 4) * 1.15, 0.085, 1150);
        // sub bass
        if (s % 8 === 0) subBass(ctx, t, out, bassRoots[group], (8 * 60 / bpm / 4) * 0.9, 0.26);
      };
      return {
        start() {
          seq = sequencer(ctx, bpm, 32, onStep);
          seq.start(ctx.currentTime + 0.08);
          // vinyl crackle bed: looped noise through a lowpass with LFO wobble
          const src = ctx.createBufferSource();
          src.buffer = getNoise(ctx);
          src.loop = true;
          const f = ctx.createBiquadFilter();
          f.type = 'lowpass';
          f.frequency.value = 1600;
          const g = ctx.createGain();
          g.gain.value = 0.006;
          const lfo = ctx.createOscillator();
          lfo.frequency.value = 0.4;
          const lg = ctx.createGain();
          lg.gain.value = 0.004;
          lfo.connect(lg).connect(g.gain);
          src.connect(f).connect(g).connect(out);
          src.start();
          lfo.start();
          vinyl = { src, lfo };
        },
        stop() {
          if (seq) { seq.stop(); seq = null; }
          if (vinyl) {
            try { vinyl.src.stop(); } catch {}
            try { vinyl.lfo.stop(); } catch {}
            vinyl = null;
          }
        },
      };
    },
  },

  {
    id: 'grid',
    name: 'Pulse Grid',
    make(ctx, out) {
      const bpm = 128;
      const acidSeq = [220, 196, 220, 261.63];
      const pads = [
        [110, 164.81, 220],     // Am
        [98, 146.83, 196],      // G
      ];
      let seq = null;
      const onStep = (t, s) => {
        // four-on-the-floor
        if (s % 4 === 0) kick(ctx, t, out, 1);
        // hats: 16ths + open on the offbeats
        if (s % 2 === 0) hat(ctx, t, out, 0.09);
        if (s % 4 === 2) hat(ctx, t, out, 0.15, true);
        // offbeat bass stab
        if (s % 4 === 2) sawBass(ctx, t, out, 55, 0.09, 0.5, 380);
        // acid squelch on beats 2 & 4
        if (s % 16 === 4 || s % 16 === 12) acidNote(ctx, t, out, acidSeq[(s >> 4) % 4], 0.24);
        // pad stab per bar, alternating chords
        if (s % 16 === 0) padChord(ctx, t, out, pads[(s >> 4) % 2], (16 * 60 / bpm / 4) * 1.02, 0.11, 900);
      };
      return {
        start() { seq = sequencer(ctx, bpm, 32, onStep); seq.start(ctx.currentTime + 0.08); },
        stop() { if (seq) { seq.stop(); seq = null; } },
      };
    },
  },
];
