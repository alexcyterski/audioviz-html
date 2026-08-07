// Shared test configuration for audio visualizer tests.
// Override via environment variables or edit directly.

const path = require('path');

module.exports = {
  // ── Visualizer URLs ──
  // Start each visualizer with: python3 -m http.server <port> -d <dir>
  dsv4f: {
    baseUrl: process.env.DSV4F_URL || 'http://localhost:8123',
    dir: path.resolve(__dirname, '..', 'dsv4f'),
  },
  q37p: {
    baseUrl: process.env.Q37P_URL || 'http://localhost:8080',
    dir: path.resolve(__dirname, '..', 'q3.7p'),
  },

  // ── GitHub Pages (deployed) ──
  dsv4fDeployed: 'https://alexcyterski.github.io/waveform-DSV4F/',
  q37pDeployed: 'https://alexcyterski.github.io/waveform-Q3.7P/',
  githubRepo: 'alexcyterski/waveform-DSV4F',

  // ── Playwright settings ──
  headless: true,
  launchArgs: [
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--disable-dev-shm-usage',
  ],

  // ── ARM64 library path (Raspberry Pi) ──
  armLibPath: path.resolve(__dirname, 'armlibs', 'usr', 'lib', 'aarch64-linux-gnu'),

  // ── Screenshot output ──
  shotsDir: path.resolve(__dirname, 'shots'),
};
