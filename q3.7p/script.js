(() => {
    'use strict';

    // ─── State ───────────────────────────────────────────────────────────
    const state = {
        mode: 'bars',
        source: null,
        sourceIndex: -1,
        isPlaying: false,
        themeIndex: 0,
        colors: ['#6366f1', '#a855f7', '#ec4899'],
        panelCollapsed: false,
        isFullscreen: false,
        barWidth: 5,
        smoothness: 0.8,
        responsiveness: 1.0,
        sensitivity: 1.0,
    };

    // ─── Themes ──────────────────────────────────────────────────────────
    const themes = [
        { name: 'Indigo',  colors: ['#6366f1', '#a855f7', '#ec4899'], gradient: 'linear-gradient(135deg, #6366f1, #ec4899)' },
        { name: 'Ocean',   colors: ['#06b6d4', '#3b82f6', '#8b5cf6'], gradient: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' },
        { name: 'Sunset',  colors: ['#f97316', '#ef4444', '#ec4899'], gradient: 'linear-gradient(135deg, #f97316, #ec4899)' },
        { name: 'Emerald', colors: ['#10b981', '#06b6d4', '#3b82f6'], gradient: 'linear-gradient(135deg, #10b981, #3b82f6)' },
        { name: 'Neon',    colors: ['#00ff87', '#60efff', '#ff00e5'], gradient: 'linear-gradient(135deg, #00ff87, #ff00e5)' },
        { name: 'Fire',    colors: ['#ff4500', '#ff8c00', '#ffd700'], gradient: 'linear-gradient(135deg, #ff4500, #ffd700)' },
        { name: 'Arctic',  colors: ['#e0f2fe', '#7dd3fc', '#0284c7'], gradient: 'linear-gradient(135deg, #e0f2fe, #0284c7)' },
        { name: 'Mono',    colors: ['#ffffff', '#999999', '#444444'], gradient: 'linear-gradient(135deg, #fff, #444)' },
    ];

    // ─── Demo Tracks ─────────────────────────────────────────────────────
    const tracks = [
        { title: 'Synthwave Dreams', artist: 'Generated Demo', generator: 'synthwave' },
        { title: 'Electric Pulse', artist: 'Generated Demo', generator: 'electric' },
        { title: 'Chill Horizon', artist: 'Generated Demo', generator: 'chill' },
    ];

    // ─── DOM ─────────────────────────────────────────────────────────────
    const $ = id => document.getElementById(id);
    const canvas = $('canvas');
    const ctx = canvas.getContext('2d');
    const app = $('app');

    // ─── Audio Engine ────────────────────────────────────────────────────
    let audioCtx = null;
    let analyser = null;
    let gainNode = null;
    let micStream = null;
    let micSource = null;
    let demoNodes = [];
    let animFrame = null;
    let freqData = null;
    let timeData = null;
    let isVisible = true;
    let idleCheckId = null;

    function initAudioContext() {
        if (audioCtx) {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(() => {});
            }
            return;
        }

        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            analyser.smoothingTimeConstant = state.smoothness;
            gainNode = audioCtx.createGain();
            gainNode.gain.value = 0.8;
            analyser.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            freqData = new Uint8Array(analyser.frequencyBinCount);
            timeData = new Uint8Array(analyser.frequencyBinCount);
        } catch (err) {
            showToast('Audio system unavailable');
            throw err;
        }
    }

    function cleanupAudio() {
        // Stop animation
        if (animFrame) {
            cancelAnimationFrame(animFrame);
            animFrame = null;
        }

        // Stop idle-check polling
        if (idleCheckId) {
            clearInterval(idleCheckId);
            idleCheckId = null;
        }

        // Stop demo nodes
        demoNodes.forEach(node => {
            try {
                if (node.stop) node.stop();
                node.disconnect();
            } catch (e) {}
        });
        demoNodes = [];

        // Stop mic
        if (micSource) {
            try { micSource.disconnect(); } catch (e) {}
            micSource = null;
        }
        if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
            micStream = null;
        }

        state.source = null;
        state.sourceIndex = -1;
        state.isPlaying = false;
    }

    function loadTrack(index) {
        cleanupAudio();
        initAudioContext();

        state.sourceIndex = index;
        state.source = 'audio';

        smoothValues.fill(0);

        const track = tracks[index];
        demoNodes = generateDemoTrack(track.generator);
        state.isPlaying = true;
        updateUI();
        startLoop();
    }

    async function startMic() {
        cleanupAudio();

        try {
            initAudioContext();
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            micSource = audioCtx.createMediaStreamSource(micStream);
            micSource.connect(analyser);
            state.source = 'mic';
            state.sourceIndex = -1;
            state.isPlaying = true;
            smoothValues.fill(0);
            updateUI();
            startLoop();
        } catch (err) {
            showToast('Microphone access denied');
            updateUI();
        }
    }

    // ─── Generated Tracks ────────────────────────────────────────────────
    function generateDemoTrack(type) {
        const nodes = [];
        const master = audioCtx.createGain();
        master.gain.value = 0.5;
        master.connect(analyser);
        nodes.push(master);

        const now = audioCtx.currentTime;

        if (type === 'synthwave') {
            const bass = audioCtx.createOscillator();
            bass.type = 'sawtooth';
            bass.frequency.value = 55;
            const bassGain = audioCtx.createGain();
            bassGain.gain.value = 0.35;
            const bassFilter = audioCtx.createBiquadFilter();
            bassFilter.type = 'lowpass';
            bassFilter.frequency.value = 200;
            bassFilter.Q.value = 8;
            const lfo = audioCtx.createOscillator();
            lfo.frequency.value = 0.15;
            const lfoGain = audioCtx.createGain();
            lfoGain.gain.value = 150;
            lfo.connect(lfoGain);
            lfoGain.connect(bassFilter.frequency);
            bass.connect(bassFilter);
            bassFilter.connect(bassGain);
            bassGain.connect(master);
            bass.start(now);
            lfo.start(now);
            nodes.push(bass, lfo);

            const pad = audioCtx.createOscillator();
            pad.type = 'sine';
            pad.frequency.value = 220;
            const pad2 = audioCtx.createOscillator();
            pad2.type = 'sine';
            pad2.frequency.value = 277.18;
            const padGain = audioCtx.createGain();
            padGain.gain.value = 0.2;
            const padLfo = audioCtx.createOscillator();
            padLfo.frequency.value = 0.3;
            const padLfoGain = audioCtx.createGain();
            padLfoGain.gain.value = 0.1;
            padLfo.connect(padLfoGain);
            padLfoGain.connect(padGain.gain);
            pad.connect(padGain);
            pad2.connect(padGain);
            padGain.connect(master);
            pad.start(now);
            pad2.start(now);
            padLfo.start(now);
            nodes.push(pad, pad2, padLfo);

            const pulse = audioCtx.createOscillator();
            pulse.type = 'square';
            pulse.frequency.value = 440;
            const pulseGain = audioCtx.createGain();
            pulseGain.gain.value = 0;
            const pulseFilter = audioCtx.createBiquadFilter();
            pulseFilter.type = 'bandpass';
            pulseFilter.frequency.value = 800;
            pulseFilter.Q.value = 5;
            pulse.connect(pulseFilter);
            pulseFilter.connect(pulseGain);
            pulseGain.connect(master);
            pulse.start(now);
            nodes.push(pulse);

            function schedulePulses() {
                const t = audioCtx.currentTime;
                for (let i = 0; i < 16; i++) {
                    const time = t + i * 0.25;
                    pulseGain.gain.setValueAtTime(0, time);
                    pulseGain.gain.linearRampToValueAtTime(0.15, time + 0.02);
                    pulseGain.gain.linearRampToValueAtTime(0, time + 0.15);
                }
            }
            schedulePulses();
            const pulseInterval = setInterval(schedulePulses, 4000);
            nodes.push({ stop: () => clearInterval(pulseInterval), disconnect: () => {} });

        } else if (type === 'electric') {
            const kick = audioCtx.createOscillator();
            kick.type = 'sine';
            kick.frequency.value = 60;
            const kickGain = audioCtx.createGain();
            kickGain.gain.value = 0;
            kick.connect(kickGain);
            kickGain.connect(master);
            kick.start(now);
            nodes.push(kick);

            function scheduleKicks() {
                const t = audioCtx.currentTime;
                for (let i = 0; i < 8; i++) {
                    const time = t + i * 0.5;
                    kickGain.gain.setValueAtTime(0, time);
                    kickGain.gain.linearRampToValueAtTime(0.6, time + 0.01);
                    kickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
                    kick.frequency.setValueAtTime(150, time);
                    kick.frequency.exponentialRampToValueAtTime(40, time + 0.1);
                }
            }
            scheduleKicks();
            const kickInterval = setInterval(scheduleKicks, 4000);
            nodes.push({ stop: () => clearInterval(kickInterval), disconnect: () => {} });

            const noiseLen = audioCtx.sampleRate * 2;
            const noiseBuffer = audioCtx.createBuffer(1, noiseLen, audioCtx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < noiseLen; i++) noiseData[i] = Math.random() * 2 - 1;
            const noise = audioCtx.createBufferSource();
            noise.buffer = noiseBuffer;
            noise.loop = true;
            const noiseFilter = audioCtx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 8000;
            const noiseGain = audioCtx.createGain();
            noiseGain.gain.value = 0;
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(master);
            noise.start(now);
            nodes.push(noise);

            function scheduleHats() {
                const t = audioCtx.currentTime;
                for (let i = 0; i < 16; i++) {
                    const time = t + i * 0.25;
                    noiseGain.gain.setValueAtTime(0, time);
                    noiseGain.gain.linearRampToValueAtTime(i % 2 === 0 ? 0.2 : 0.1, time + 0.005);
                    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
                }
            }
            scheduleHats();
            const hatInterval = setInterval(scheduleHats, 4000);
            nodes.push({ stop: () => clearInterval(hatInterval), disconnect: () => {} });

            const synth = audioCtx.createOscillator();
            synth.type = 'sawtooth';
            synth.frequency.value = 330;
            const synthGain = audioCtx.createGain();
            synthGain.gain.value = 0;
            const synthFilter = audioCtx.createBiquadFilter();
            synthFilter.type = 'lowpass';
            synthFilter.frequency.value = 1000;
            synth.connect(synthFilter);
            synthFilter.connect(synthGain);
            synthGain.connect(master);
            synth.start(now);
            nodes.push(synth);

            function scheduleStabs() {
                const t = audioCtx.currentTime;
                for (let i = 0; i < 4; i++) {
                    const time = t + i * 1;
                    synthGain.gain.setValueAtTime(0, time);
                    synthGain.gain.linearRampToValueAtTime(0.2, time + 0.02);
                    synthGain.gain.linearRampToValueAtTime(0, time + 0.6);
                    synthFilter.frequency.setValueAtTime(2000, time);
                    synthFilter.frequency.exponentialRampToValueAtTime(300, time + 0.5);
                }
            }
            scheduleStabs();
            const stabInterval = setInterval(scheduleStabs, 4000);
            nodes.push({ stop: () => clearInterval(stabInterval), disconnect: () => {} });

        } else { // chill
            const freqs = [130.81, 164.81, 196, 246.94];
            freqs.forEach(f => {
                const osc = audioCtx.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = f;
                const g = audioCtx.createGain();
                g.gain.value = 0.12;
                const lfo = audioCtx.createOscillator();
                lfo.frequency.value = 0.1 + Math.random() * 0.2;
                const lfoG = audioCtx.createGain();
                lfoG.gain.value = 0.05;
                lfo.connect(lfoG);
                lfoG.connect(g.gain);
                osc.connect(g);
                g.connect(master);
                osc.start(now);
                lfo.start(now);
                nodes.push(osc, lfo);
            });

            const bellFreqs = [523.25, 659.25, 783.99, 1046.5];
            const bell = audioCtx.createOscillator();
            bell.type = 'sine';
            bell.frequency.value = bellFreqs[0];
            const bellGain = audioCtx.createGain();
            bellGain.gain.value = 0;
            bell.connect(bellGain);
            bellGain.connect(master);
            bell.start(now);
            nodes.push(bell);
            let bellIdx = 0;

            function scheduleBells() {
                const t = audioCtx.currentTime;
                for (let i = 0; i < 4; i++) {
                    const time = t + i * 1;
                    bell.frequency.setValueAtTime(bellFreqs[bellIdx % bellFreqs.length], time);
                    bellGain.gain.setValueAtTime(0, time);
                    bellGain.gain.linearRampToValueAtTime(0.15, time + 0.02);
                    bellGain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
                    bellIdx++;
                }
            }
            scheduleBells();
            const bellInterval = setInterval(scheduleBells, 4000);
            nodes.push({ stop: () => clearInterval(bellInterval), disconnect: () => {} });
        }

        return nodes;
    }

    // ─── Visualization Loop ──────────────────────────────────────────────
    let particles = [];
    const smoothValues = new Float32Array(256);

    function startLoop() {
        if (animFrame) cancelAnimationFrame(animFrame);

        function loop() {
            if (!isVisible) {
                animFrame = requestAnimationFrame(loop);
                return;
            }
            animFrame = requestAnimationFrame(loop);
            draw();
        }
        loop();
    }

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function draw() {
        if (!analyser || !freqData || !timeData) return;

        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const [c1, c2, c3] = state.colors;

        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
        ctx.fillRect(0, 0, w, h);

        switch (state.mode) {
            case 'bars': drawBars(w, h, c1, c2, c3); break;
            case 'wave': drawWave(w, h, c1, c2, c3); break;
            case 'circular': drawCircular(w, h, c1, c2, c3); break;
            case 'particles': drawParticles(w, h, c1, c2, c3); break;
            case 'mountain': drawMountain(w, h, c1, c2, c3); break;
            case 'galaxy': drawGalaxy(w, h, c1, c2, c3); break;
        }
    }

    function drawBars(w, h, c1, c2, c3) {
        const count = Math.max(20, Math.floor(w / (state.barWidth * 2)));
        const barW = (w / count) * 0.75;
        const gap = (w / count) * 0.25;
        const step = Math.floor(freqData.length / count);

        for (let i = 0; i < count; i++) {
            const raw = (freqData[i * step] / 255) * state.sensitivity;
            const idx = i % smoothValues.length;
            smoothValues[idx] += (raw - smoothValues[idx]) * state.responsiveness;
            const val = smoothValues[idx];
            const barH = val * h * 0.85;

            const x = i * (barW + gap) + gap / 2;
            const y = h - barH;

            const grad = ctx.createLinearGradient(x, h, x, y);
            grad.addColorStop(0, c1);
            grad.addColorStop(0.5, c2);
            grad.addColorStop(1, c3);

            ctx.fillStyle = grad;
            ctx.beginPath();
            const r = Math.min(barW / 2, 4);
            ctx.roundRect(x, y, barW, barH, [r, r, 0, 0]);
            ctx.fill();

            ctx.globalAlpha = 0.15;
            ctx.fillStyle = grad;
            ctx.fillRect(x, h, barW, barH * 0.3);
            ctx.globalAlpha = 1;
        }
    }

    function drawWave(w, h, c1, c2, c3) {
        for (let layer = 2; layer >= 0; layer--) {
            ctx.beginPath();
            const colors = [c1, c2, c3];
            ctx.strokeStyle = colors[layer];
            ctx.lineWidth = 3 - layer * 0.5;
            ctx.globalAlpha = 1 - layer * 0.25;

            const sliceW = w / timeData.length;
            const offset = layer * 20;

            for (let i = 0; i < timeData.length; i++) {
                const v = ((timeData[i] - 128) / 128) * state.sensitivity;
                const y = h / 2 + v * (h * 0.35) + offset * Math.sin(i * 0.01);
                const x = i * sliceW;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawCircular(w, h, c1, c2, c3) {
        const cx = w / 2;
        const cy = h / 2;
        const baseR = Math.min(w, h) * 0.2;
        const bars = Math.min(128, Math.floor(w / 4));
        const time = Date.now() * 0.001;

        const avgFreq = avg(freqData, 0, 64) / 255;
        const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseR * 1.5);
        glowGrad.addColorStop(0, hexToRgba(c1, avgFreq * 0.4));
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, w, h);

        for (let i = 0; i < bars; i++) {
            const val = (freqData[i % freqData.length] / 255) * state.sensitivity;
            const angle = (i / bars) * Math.PI * 2 + time * 0.2;
            const barLen = val * baseR * 1.2;

            const x1 = cx + Math.cos(angle) * baseR;
            const y1 = cy + Math.sin(angle) * baseR;
            const x2 = cx + Math.cos(angle) * (baseR + barLen);
            const y2 = cy + Math.sin(angle) * (baseR + barLen);

            const t = i / bars;
            const color = t < 0.33 ? c1 : t < 0.66 ? c2 : c3;

            ctx.strokeStyle = color;
            ctx.lineWidth = Math.max(1.5, (w / bars) * 0.6);
            ctx.globalAlpha = 0.6 + val * 0.4;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    function drawParticles(w, h, c1, c2, c3) {
        const colors = [c1, c2, c3];
        const avgFreq = (avg(freqData, 0, 32) / 255) * state.sensitivity;
        const bass = (avg(freqData, 0, 8) / 255) * state.sensitivity;

        const spawnCount = Math.floor(bass * 5);
        for (let i = 0; i < spawnCount; i++) {
            if (particles.length < 200) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + avgFreq * 4;
                particles.push({
                    x: w / 2,
                    y: h / 2,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 1,
                    decay: 0.005 + Math.random() * 0.015,
                    size: 2 + Math.random() * 4,
                    color: colors[Math.floor(Math.random() * 3)],
                });
            }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.99;
            p.vy *= 0.99;
            p.life -= p.decay;

            if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
                particles.splice(i, 1);
                continue;
            }

            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        const glowGrad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, 80 + bass * 60);
        glowGrad.addColorStop(0, hexToRgba(c1, 0.3 + bass * 0.3));
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, w, h);
    }

    function drawMountain(w, h, c1, c2, c3) {
        const layers = 4;
        const colors = [c1, c2, c3, c1];

        for (let l = layers - 1; l >= 0; l--) {
            const scale = 1 - l * 0.15;
            ctx.beginPath();
            ctx.moveTo(0, h);

            const points = 80;
            for (let i = 0; i <= points; i++) {
                const x = (i / points) * w;
                const fi = Math.floor((i / points) * freqData.length * 0.5);
                const val = (freqData[fi] / 255) * state.sensitivity;
                const y = h - val * h * 0.7 * scale - l * 15;
                if (i === 0) ctx.lineTo(x, y);
                else {
                    const px = ((i - 0.5) / points) * w;
                    const pfi = Math.floor(((i - 0.5) / points) * freqData.length * 0.5);
                    const pval = (freqData[pfi] / 255) * state.sensitivity;
                    const py = h - pval * h * 0.7 * scale - l * 15;
                    ctx.quadraticCurveTo(px, py, x, y);
                }
            }

            ctx.lineTo(w, h);
            ctx.closePath();

            ctx.globalAlpha = 0.6 + l * 0.1;
            const grad = ctx.createLinearGradient(0, h * 0.2, 0, h);
            grad.addColorStop(0, colors[l]);
            grad.addColorStop(1, hexToRgba(colors[l], 0.2));
            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    function drawGalaxy(w, h, c1, c2, c3) {
        const cx = w / 2;
        const cy = h / 2;
        const time = Date.now() * 0.0005;
        const bass = (avg(freqData, 0, 8) / 255) * state.sensitivity;
        const mid = (avg(freqData, 32, 96) / 255) * state.sensitivity;
        const arms = 5;
        const colors = [c1, c2, c3];

        for (let arm = 0; arm < arms; arm++) {
            const armOffset = (arm / arms) * Math.PI * 2;
            const starCount = 60;

            for (let s = 0; s < starCount; s++) {
                const t = s / starCount;
                const r = t * Math.min(w, h) * 0.45;
                const spiralAngle = armOffset + t * Math.PI * 3 + time;
                const freqIdx = Math.floor(t * 64);
                const val = (freqData[freqIdx] / 255) * state.sensitivity;

                const jitter = (Math.sin(s * 127.1 + time * 3) * 0.5 + 0.5) * 20;
                const x = cx + Math.cos(spiralAngle) * (r + jitter) * (0.8 + bass * 0.3);
                const y = cy + Math.sin(spiralAngle) * (r + jitter) * (0.8 + bass * 0.3);

                const size = 1 + val * 4 + mid * 2;
                ctx.globalAlpha = 0.3 + val * 0.7;
                ctx.fillStyle = colors[arm % 3];
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 60 + bass * 40);
        glowGrad.addColorStop(0, hexToRgba(c1, 0.5 + bass * 0.3));
        glowGrad.addColorStop(0.5, hexToRgba(c2, 0.2));
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, w, h);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────
    function avg(arr, start, end) {
        let sum = 0;
        for (let i = start; i < end && i < arr.length; i++) sum += arr[i];
        return sum / (end - start);
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function showToast(msg) {
        const toast = $('toast');
        toast.textContent = msg;
        toast.classList.add('visible');
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => toast.classList.remove('visible'), 2500);
    }

    // ─── UI Updates ──────────────────────────────────────────────────────
    function updateUI() {
        const playBtn = $('play-btn');
        const isAudioSource = state.source === 'audio';
        const isMicSource = state.source === 'mic';

        playBtn.classList.toggle('hidden', !isAudioSource && !isMicSource);
        $('play-icon').innerHTML = state.isPlaying
            ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>'
            : '<path d="M8 5v14l11-7z"/>';

        $('progress-section').classList.toggle('visible', false);

        const trackInfo = $('track-info');
        if (isAudioSource && state.sourceIndex >= 0) {
            const track = tracks[state.sourceIndex];
            $('track-title').textContent = track.title;
            $('track-subtitle').textContent = track.artist;
            trackInfo.classList.add('visible');
        } else if (isMicSource) {
            $('track-title').innerHTML = '<span class="mic-live"><span class="mic-dot"></span>Listening</span>';
            $('track-subtitle').textContent = 'Microphone input';
            trackInfo.classList.add('visible');
        } else {
            trackInfo.classList.remove('visible');
        }

        $('idle-overlay').classList.toggle('hidden', state.source !== null);

        document.querySelectorAll('.source-pill').forEach(pill => {
            const src = pill.dataset.source;
            const isActive = src === 'mic' ? isMicSource
                : parseInt(src) === state.sourceIndex && isAudioSource;
            pill.classList.toggle('active', isActive);
        });

        document.querySelectorAll('.viz-option').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.mode === state.mode);
        });

        document.querySelectorAll('.theme-swatch').forEach((sw, i) => {
            sw.classList.toggle('active', i === state.themeIndex);
        });
    }

    function buildThemes() {
        const row = $('theme-row');
        themes.forEach((theme, i) => {
            const swatch = document.createElement('div');
            swatch.className = 'theme-swatch' + (i === 0 ? ' active' : '');
            swatch.style.background = theme.gradient;
            swatch.title = theme.name;
            swatch.addEventListener('click', () => {
                state.themeIndex = i;
                state.colors = [...theme.colors];
                $('custom-color1').value = state.colors[0];
                $('custom-color2').value = state.colors[1];
                $('custom-color3').value = state.colors[2];
                updateUI();
            });
            row.appendChild(swatch);
        });
    }

    // ─── Event Listeners ─────────────────────────────────────────────────
    $('source-pills').addEventListener('click', e => {
        const pill = e.target.closest('.source-pill');
        if (!pill) return;
        const src = pill.dataset.source;
        if (src === 'mic') startMic();
        else loadTrack(parseInt(src));
    });

    $('viz-grid').addEventListener('click', e => {
        const opt = e.target.closest('.viz-option');
        if (!opt) return;
        state.mode = opt.dataset.mode;
        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;
        ctx.clearRect(0, 0, w, h);
        if (state.mode === 'particles') particles = [];
        smoothValues.fill(0);
        updateUI();
    });

    $('play-btn').addEventListener('click', () => {
        if (state.source === 'audio') {
            loadTrack(state.sourceIndex);
        } else if (state.source === 'mic') {
            startMic();
        }
    });

    $('prev-btn').addEventListener('click', () => {
        if (state.source !== 'audio') return;
        const idx = (state.sourceIndex - 1 + tracks.length) % tracks.length;
        loadTrack(idx);
    });

    $('next-btn').addEventListener('click', () => {
        if (state.source !== 'audio') {
            loadTrack(0);
        } else {
            const idx = (state.sourceIndex + 1) % tracks.length;
            loadTrack(idx);
        }
    });

    $('volume-slider').addEventListener('input', e => {
        if (gainNode) gainNode.gain.value = e.target.value / 100;
    });

    ['custom-color1', 'custom-color2', 'custom-color3'].forEach((id, i) => {
        $(id).addEventListener('input', e => {
            state.colors[i] = e.target.value;
            state.themeIndex = -1;
            updateUI();
        });
    });

    $('bar-width').addEventListener('input', e => {
        state.barWidth = parseInt(e.target.value);
        $('bar-width-value').textContent = state.barWidth;
    });

    $('smoothness').addEventListener('input', e => {
        state.smoothness = parseInt(e.target.value) / 100;
        $('smoothness-value').textContent = e.target.value + '%';
        if (analyser) analyser.smoothingTimeConstant = state.smoothness;
    });

    $('responsiveness').addEventListener('input', e => {
        const v = parseInt(e.target.value) / 10;
        state.responsiveness = Math.min(1.0, Math.max(0.1, v));
        $('responsiveness-value').textContent = e.target.value;
    });

    $('sensitivity').addEventListener('input', e => {
        state.sensitivity = parseInt(e.target.value) / 100;
        $('sensitivity-value').textContent = e.target.value + '%';
    });

    $('panel-handle').addEventListener('click', () => {
        state.panelCollapsed = !state.panelCollapsed;
        $('panel').classList.toggle('collapsed', state.panelCollapsed);
        setTimeout(resizeCanvas, 400);
    });

    $('idle-start').addEventListener('click', () => loadTrack(0));

    $('fullscreen-btn').addEventListener('click', () => {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
        state.isFullscreen = true;
        app.classList.add('fullscreen');
        setTimeout(resizeCanvas, 100);
    });

    $('exit-fullscreen').addEventListener('click', () => {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        state.isFullscreen = false;
        app.classList.remove('fullscreen');
        setTimeout(resizeCanvas, 100);
    });

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            state.isFullscreen = false;
            app.classList.remove('fullscreen');
            setTimeout(resizeCanvas, 100);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'INPUT') return;
        if (e.code === 'Space') {
            e.preventDefault();
            $('play-btn').click();
        }
        if (e.code === 'KeyF') $('fullscreen-btn').click();
        if (e.code === 'Escape' && state.isFullscreen) $('exit-fullscreen').click();
    });

    document.addEventListener('visibilitychange', () => {
        isVisible = !document.hidden;
        if (isVisible && state.isPlaying) {
            resizeCanvas();
        }
    });

    // ─── Init ────────────────────────────────────────────────────────────
    buildThemes();
    updateUI();

    function idleDraw() {
        if (!isVisible) {
            if (state.source === null) requestAnimationFrame(idleDraw);
            return;
        }
        if (state.source !== null) {
            // Source active — main loop takes over. Re-check when source clears.
            idleCheckId = setInterval(() => {
                if (state.source === null) {
                    clearInterval(idleCheckId);
                    idleCheckId = null;
                    idleDraw();
                }
            }, 200);
            return;
        }
        requestAnimationFrame(idleDraw);
        const rect = canvas.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        ctx.fillStyle = 'rgba(10, 10, 15, 0.08)';
        ctx.fillRect(0, 0, w, h);

        const t = Date.now() * 0.001;
        const [c1, c2, c3] = state.colors;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.strokeStyle = [c1, c2, c3][i];
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.3;
            for (let x = 0; x < w; x += 2) {
                const y = h/2 + Math.sin(x * 0.01 + t + i * 2) * 30 * Math.sin(t * 0.5 + i);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
    idleDraw();
})();
