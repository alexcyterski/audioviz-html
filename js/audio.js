// AudioEngine — owns the AudioContext, routes demo tracks or the microphone
// into one analyser, and exposes normalized frequency/waveform data to the
// visualizers. 64 log-spaced bands from ~30Hz to 14kHz.

import { TRACKS } from './tracks.js';

const BANDS = 64;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.master = null;

    this.track = null;       // active demo track handle
    this.trackId = null;
    this.micStream = null;
    this.micGain = null;
    this.micLevel = 0;

    this.volume = 0.8;

    this.freq = null;
    this.wave = null;
    this.bands = new Float32Array(BANDS);
    this.waveNorm = new Float32Array(2048);
    this.energy = 0;
    this.bass = 0;
    this.mid = 0;
    this.treb = 0;
    this.kick = 0;

    this._bandIdx = null;
    this._bassPrev = 0;
  }

  ensure() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.82;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Uint8Array(this.analyser.fftSize);
      this.waveNorm = new Float32Array(this.analyser.fftSize);
      this._buildBandMap();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  _buildBandMap() {
    const sr = this.ctx.sampleRate;
    const binHz = sr / this.analyser.fftSize;
    const f0 = 30, f1 = 14000;
    const start = new Int32Array(BANDS);
    const end = new Int32Array(BANDS);
    for (let i = 0; i < BANDS; i++) {
      const fL = f0 * Math.pow(f1 / f0, i / BANDS);
      const fH = f0 * Math.pow(f1 / f0, (i + 1) / BANDS);
      start[i] = Math.max(1, Math.floor(fL / binHz));
      end[i] = Math.max(start[i] + 1, Math.ceil(fH / binHz));
    }
    this._bandIdx = { start, end };
  }

  /** Pull fresh analyser data into bands/energy/waveform. Call once per frame. */
  update(sens = 1) {
    if (!this.analyser) {
      this.bands.fill(0);
      this.waveNorm.fill(0);
      this.energy = this.bass = this.mid = this.treb = this.kick = 0;
      return;
    }
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.wave);

    const f = this.freq;
    const { start, end } = this._bandIdx;
    for (let i = 0; i < BANDS; i++) {
      let sum = 0, n = 0;
      for (let b = start[i]; b < end[i]; b++) { sum += f[b]; n++; }
      let v = (sum / Math.max(1, n)) / 255 * sens;
      this.bands[i] = v > 1 ? 1 : v;
    }

    let e = 0;
    for (let i = 0; i < BANDS; i++) e += this.bands[i];
    e /= BANDS;
    this.energy = e;
    let b = 0, m = 0, tr = 0;
    for (let i = 0; i < 20; i++) b += this.bands[i];
    for (let i = 20; i < 44; i++) m += this.bands[i];
    for (let i = 44; i < BANDS; i++) tr += this.bands[i];
    this.bass = b / 20;
    this.mid = m / 24;
    this.treb = tr / 20;

    this.kick = Math.max(0, this.bass - this._bassPrev);
    this._bassPrev = this.bass;

    const w = this.wave;
    const wn = this.waveNorm;
    for (let i = 0; i < w.length; i++) wn[i] = (w[i] - 128) / 128;

    if (this.micStream) {
      let peak = 0;
      for (let i = 0; i < w.length; i += 16) {
        const d = Math.abs(w[i] - 128) / 128;
        if (d > peak) peak = d;
      }
      this.micLevel += (peak - this.micLevel) * 0.3;
    }
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) {
      this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.03);
    }
  }

  /* ---------- Sources ---------- */

  async playTrack(id) {
    this.ensure();
    await this.stopAllSources();
    const def = TRACKS.find((t) => t.id === id);
    if (!def) throw new Error('Unknown track: ' + id);
    this.trackId = id;
    this.track = def.make(this.ctx, this.master);
    this.track.start(this.ctx.currentTime + 0.05);
  }

  stopTrack() {
    if (this.track) {
      this.track.stop();
      this.track = null;
    }
  }

  async startMic() {
    this.ensure();
    await this.stopAllSources();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.micStream = stream;
    const src = this.ctx.createMediaStreamSource(stream);
    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = 0.7;
    src.connect(this.micGain);
    this.micGain.connect(this.master);
  }

  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.micGain) {
      try { this.micGain.disconnect(); } catch {}
      this.micGain = null;
    }
    this.micLevel = 0;
  }

  async stopAllSources() {
    this.stopTrack();
    this.stopMic();
  }
}
