# 🌊 Waveform

A lightweight, zero-dependency audio visualizer for the browser — pure Web Audio API + Canvas, no frameworks, no CDNs, no audio files.

**The mission:** this project tests the capabilities of **DeepSeek V4 Flash (0731)** by continually improving an audio visualizer with it. Every feature, fix, and polish pass is built through iterative AI collaboration, and the codebase is the benchmark.

## Live demo

https://alexcyterski.github.io/waveform-DSV4F/

## What it does

- **5 visualizer modes** — Spectrum, Orbit, Nebula, Wave, Pulse
- **3 generative demo tracks** — synthwave, lo-fi, and techno, synthesized live in the browser (zero audio files)
- **Live mic input** — `getUserMedia` → analyser, with a level indicator
- **Controls** — mode picker, 5 color themes, sensitivity / detail / volume, mirror, fullscreen
- **Gestures** — tap the canvas to play/pause (or dismiss the menu), swipe to cycle
  modes, drag the grip bar down to hide the menu; keyboard shortcuts on desktop
- Mobile-first: tuned for phones, works on laptops

## Run it

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Mic input requires a secure context — `localhost` or any HTTPS host.

## Stack

`index.html` + `css/` + `js/` is the entire app. No build step, no dependencies.
