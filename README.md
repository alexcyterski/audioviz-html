# 🎧 Audio Visualizer

Two browser-based audio visualizers built with pure Web Audio API + Canvas — no frameworks, no dependencies, no audio files.

Each visualizer was developed with a different AI model as a benchmark test.

## Projects

| Directory | Model | Live Demo | Modes | Tracks |
|-----------|-------|-----------|-------|--------|
| [`dsv4f/`](dsv4f/) | DeepSeek V4 Flash (0731) | [waveform-DSV4F](https://alexcyterski.github.io/waveform-DSV4F/) | 5 | 4 |
| [`q3.7p/`](q3.7p/) | Qwen 3.7P | [waveform-Q3.7P](https://alexcyterski.github.io/waveform-Q3.7P/) | 5 | 3 |

## Quick Start

```bash
# Run DSV4F visualizer
cd dsv4f && python3 -m http.server 8123

# Run Q3.7P visualizer
cd q3.7p && python3 -m http.server 8080
```

Mic input requires a secure context (localhost or HTTPS).

## Project Structure

```
audioviz/
├── dsv4f/            # DeepSeek V4 Flash visualizer
│   ├── index.html
│   ├── css/
│   └── js/
├── q3.7p/            # Qwen 3.7P visualizer
│   ├── index.html
│   ├── styles.css
│   └── script.js
├── tests/            # Playwright test suite
│   ├── config.js     # Shared test configuration
│   ├── dsv4f/        # DSV4F-specific tests
│   ├── q3.7p/        # Q3.7P-specific tests
│   ├── github/       # GitHub Pages / CI checks
│   ├── armlibs/      # ARM64 libraries for Raspberry Pi
│   └── shots/        # Test screenshots
└── README.md
```

## Testing

Tests use [Playwright](https://playwright.dev/) for headless Chromium testing.

```bash
cd tests
npm install   # first time only

# Run DSV4F tests (start server first: cd ../dsv4f && python3 -m http.server 8123)
node dsv4f/shots.js

# Run Q3.7P tests (start server first: cd ../q3.7p && python3 -m http.server 8080)
node q3.7p/final_test.js

# On Raspberry Pi, prefix with:
LD_LIBRARY_PATH=$PWD/armlibs/usr/lib/aarch64-linux-gnu node dsv4f/shots.js
```

### Test URLs

Configure test URLs via environment variables:
```bash
DSV4F_URL=http://localhost:8123 node dsv4f/shots.js
Q37P_URL=http://localhost:8080 node q3.7p/final_test.js
```

## Tech Stack

- **Web Audio API** — real-time audio analysis with 2048-bin FFT
- **Canvas 2D** — 60fps rendering with requestAnimationFrame
- **Zero dependencies** — no build step, no frameworks, no CDNs
- **Mobile-first** — tuned for phones, works on laptops
