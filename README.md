# Kimi K3 — Audio Visualizer

Pure Web Audio + Canvas visualizer — no frameworks, no dependencies, no audio files. Built with [Kimi K3](https://www.moonshot.cn/) (Moonshot AI).

- **6 viz modes** — Spectra, Halo, Drift, Ribbon, Bloom, Matrix — each with its own settings (bars/spokes/particles, mirror, trails, wobble…)
- **6 color palettes** + sensitivity & volume tuning
- **3 generative demo tracks** (synthwave / lo-fi / techno) synthesized live with a lookahead step-sequencer, plus **live mic input**
- Mobile-first: gesture controls (tap = play/pause, swipe = switch mode), collapsible glass control sheet; desktop gets a side panel
- URL params for shareable looks: `?mode=halo&palette=aurora&track=lofi&autoplay=1`

## Run

```bash
python3 -m http.server 8901
# → http://localhost:8901
```

Keyboard: `space` play/pause · `1–6` modes · `m` mic · `t` next track · `←/→` cycle modes · `f` fullscreen.
