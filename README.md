# 🎛️ Waveform (Kimi K3)

**Live site: https://alexcyterski.github.io/audioviz-html/**

A benchmark-built audio visualizer: see how far Kimi K3 (Moonshot AI) can take pure Web Audio API + Canvas — no frameworks, no dependencies, no audio files.

**6 modes** (Spectra, Halo, Drift, Ribbon, Bloom, Matrix) with per-mode settings · **6 color palettes** · **3 generative demo tracks** · **Mic input** · Mobile glass control sheet + desktop side panel · Gesture & keyboard controls.

## Run

```bash
python3 -m http.server 8000
```

Keyboard: `space` play/pause · `1–6` modes · `m` mic · `t` next track · `←/→` cycle · `f` fullscreen.
Shareable looks via URL params: `?mode=halo&palette=aurora&track=lofi&autoplay=1`
