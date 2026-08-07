# 🎧 Audio Visualizer

Browser-based audio visualizers built with pure Web Audio API + Canvas — no frameworks, no dependencies, no audio files. Each was developed with a different AI model as a benchmark.

## Projects

**[`dsv4f/`](dsv4f/)** — Built with [DeepSeek V4 Flash](https://github.com/alexcyterski/waveform-DSV4F). 5 viz modes (Spectrum, Orbit, Nebula, Wave, Pulse), 4 generative demo tracks, mic input, mobile-first with gesture controls.

**[`q3.7p/`](q3.7p/)** — Built with [Qwen 3.7P](https://github.com/alexcyterski/waveform-Q3.7P). 5 viz modes (Bars, Wave, Radial, Spectrum, Particles), 3 demo tracks, mic input, custom color pickers, collapsible panel.

**[`kimi-k3/`](kimi-k3/)** — Built with Kimi K3 (Moonshot AI). 6 viz modes (Spectra, Halo, Drift, Ribbon, Bloom, Matrix) with per-mode settings, 6 palettes, 3 generative tracks, mic input, mobile sheet + desktop panel.

## Run

```bash
cd dsv4f && python3 -m http.server 8123
cd q3.7p && python3 -m http.server 8080
cd kimi-k3 && python3 -m http.server 8901
```

## Testing

Playwright-based tests live in `tests/`. See `tests/config.js` for URLs and settings.
