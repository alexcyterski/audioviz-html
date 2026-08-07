/* ═══════════════════════════════════════════════════════════════
   Kimi K3 — AudioEngine
   One AudioContext + one AnalyserNode. Demo track OR mic → master
   gain → analyser → destination. Exposes 64 log-spaced bands,
   normalized waveform, energy/bass/mid/treb and a kick detector.
   ═══════════════════════════════════════════════════════════════ */
'use strict';

window.K3 = window.K3 || {};

(function () {

  const FFT_SIZE = 2048;
  const NUM_BANDS = 64;
  const F_MIN = 30, F_MAX = 14000;

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.analyser = null;
      this.master = null;
      this.micGain = null;
      this.micStream = null;
      this.track = null;        // active generative track { start, stop }
      this.trackId = null;
      this.source = 'idle';     // 'idle' | 'track' | 'mic'
      this.playing = false;

      this.freq = new Uint8Array(FFT_SIZE / 2);
      this.time = new Uint8Array(FFT_SIZE);
      this.bands = new Float32Array(NUM_BANDS);
      this.wave = new Float32Array(512);      // normalized -1..1
      this.energy = 0; this.bass = 0; this.mid = 0; this.treb = 0;
      this.kick = 0;
      this._bassPrev = 0;
      this._bandMap = null;                    // log band → fft bin ranges
      this.silent = true;
    }

    /* Must be called from a user gesture (autoplay policy). */
    _ensureCtx() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.82;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      // Precompute log-spaced band → bin ranges.
      const binHz = this.ctx.sampleRate / FFT_SIZE;
      this._bandMap = [];
      for (let i = 0; i < NUM_BANDS; i++) {
        const f0 = F_MIN * Math.pow(F_MAX / F_MIN, i / NUM_BANDS);
        const f1 = F_MIN * Math.pow(F_MAX / F_MIN, (i + 1) / NUM_BANDS);
        let b0 = Math.max(1, Math.floor(f0 / binHz));
        let b1 = Math.min(this.freq.length - 1, Math.ceil(f1 / binHz));
        if (b1 <= b0) b1 = b0 + 1;
        this._bandMap.push([b0, b1]);
      }
    }

    resume() {
      this._ensureCtx();
      if (this.ctx.state === 'suspended') return this.ctx.resume();
      return Promise.resolve();
    }

    setVolume(v) {
      if (this.master) this.master.gain.value = v;
    }

    _stopSources() {
      if (this.track) { try { this.track.stop(); } catch (e) {} this.track = null; }
      this.trackId = null;
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }
      if (this.micGain) { try { this.micGain.disconnect(); } catch (e) {} this.micGain = null; }
      this.playing = false;
      this.source = 'idle';
      this._resetAnalysis();
    }

    _resetAnalysis() {
      this.bands.fill(0);
      this.wave.fill(0);
      this.energy = this.bass = this.mid = this.treb = this.kick = 0;
      this._bassPrev = 0;
      this.silent = true;
    }

    /* Play a generative demo track by id. */
    playTrack(id) {
      this._ensureCtx();
      this._stopSources();
      const def = K3.tracks.find((t) => t.id === id) || K3.tracks[0];
      this.track = def.create(this.ctx, this.master);
      this.trackId = def.id;
      this._lastTrackId = def.id;
      return this.resume().then(() => {
        this.track.start();
        this.source = 'track';
        this.playing = true;
        return def;
      });
    }

    /* Enable microphone input. */
    startMic() {
      this._ensureCtx();
      this._stopSources();
      return navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      }).then((stream) => {
        this.micStream = stream;
        const src = this.ctx.createMediaStreamSource(stream);
        this.micGain = this.ctx.createGain();
        this.micGain.gain.value = 1.0;
        src.connect(this.micGain);
        this.micGain.connect(this.master);
        return this.resume();
      }).then(() => {
        this.source = 'mic';
        this.playing = true;
      });
    }

    stop() { this._stopSources(); }

    toggle() {
      if (this.playing) { this._stopSources(); return Promise.resolve(null); }
      // Resume last track, or first.
      return this.playTrack(this._lastTrackId || (K3.tracks[0] && K3.tracks[0].id));
    }

    /* Per-frame analysis. sens scales band values. */
    update(sens) {
      if (!this.analyser || !this.playing) { this.silent = true; return; }
      this.analyser.getByteFrequencyData(this.freq);
      this.analyser.getByteTimeDomainData(this.time);

      let eSum = 0;
      for (let i = 0; i < NUM_BANDS; i++) {
        const [b0, b1] = this._bandMap[i];
        let sum = 0;
        for (let b = b0; b < b1; b++) sum += this.freq[b];
        let val = (sum / (b1 - b0)) / 255;
        // Perceptual lift: quiet highs get boosted so the top end stays alive.
        val = Math.pow(val, 0.86) * (1 + (i / NUM_BANDS) * 0.55);
        val = Math.min(1, val * sens);
        this.bands[i] = val;
        eSum += val;
      }
      this.energy = eSum / NUM_BANDS;

      const avg = (a, b) => {
        let s = 0;
        for (let i = a; i < b; i++) s += this.bands[i];
        return s / (b - a);
      };
      this.bass = avg(0, 12);
      this.mid = avg(12, 36);
      this.treb = avg(36, NUM_BANDS);
      this.kick = Math.max(0, this.bass - this._bassPrev);
      this._bassPrev += (this.bass - this._bassPrev) * 0.55;
      this.silent = this.energy < 0.004;

      // Waveform: downsample time domain into 512 normalized points.
      const step = this.time.length / this.wave.length;
      for (let i = 0; i < this.wave.length; i++) {
        this.wave[i] = (this.time[(i * step) | 0] - 128) / 128;
      }
    }
  }

  K3.engine = new AudioEngine();
  K3.NUM_BANDS = NUM_BANDS;

})();
