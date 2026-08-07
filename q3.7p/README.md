# Waveform Audio Visualizer

A polished, professional audio visualization web app built with pure HTML, CSS, and JavaScript. No frameworks, no dependencies — just clean, modern web standards.

**🎧 [Try it live on GitHub Pages](https://alexcyterski.github.io/waveform-Q3.7P/)**

## Features

### Audio Sources
- **Generated Demo Tracks**: Three Web Audio API-generated tracks (Synthwave, Electronic, Chill) that work instantly without network requests
- **Microphone Input**: Real-time visualization of your device's microphone

### Visualization Modes
- **Bars**: Classic frequency bar graph
- **Wave**: Waveform display
- **Radial**: Circular frequency spectrum
- **Spectrum**: Detailed frequency analysis
- **Particles**: Dynamic particle system

### Customization
- **8 Color Themes**: Indigo, Ocean, Sunset, Emerald, Neon, Fire, Arctic, Mono
- **Custom Colors**: Three color pickers for full control
- **4 Control Sliders**:
  - Bar Width: Adjust visualization density
  - Smoothness: Control audio analyser FFT smoothing
  - Responsiveness: How quickly visuals react to audio
  - Sensitivity: Scale the visual output

### UI/UX
- **Mobile-first design**: Optimized for phones, adapts to tablets and desktop
- **Collapsible bottom panel**: Swipe-style handle, maximizes canvas space
- **Keyboard shortcuts**: Space (play/pause), F (fullscreen), Esc (exit fullscreen)
- **Safe area insets**: Proper support for notched devices
- **Touch-friendly controls**: 44px minimum touch targets

## File Structure

```
waveform-Q3.7P/
├── index.html      # Semantic HTML structure
── styles.css      # All styling (CSS variables, responsive, animations)
└── script.js       # Application logic (audio engine, visualization, UI)
```

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions, including iOS)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development

### Local Testing

```bash
# Start a local server
cd waveform-Q3.7P
python3 -m http.server 8080

# Open in browser
# http://localhost:8080
```

### Testing

The app has been tested with Playwright (headless Chromium):

```bash
cd ~/viztest
LD_LIBRARY_PATH=/home/hermes/armlibs/usr/lib/aarch64-linux-gnu node full_test.js
```

All tests pass with zero JavaScript errors and zero console errors.

## Deployment

### GitHub Pages

1. Push to GitHub
2. Enable Pages in repo settings
3. Branch: `main`, Root: `/`
4. Live at: `https://alexcyterski.github.io/waveform-Q3.7P/`

### Local File System

Works directly from file system — just open `index.html` in a browser. No build step required.

## Technical Details

### Audio Engine
- **Web Audio API**: Real-time audio analysis with 2048-bin FFT
- **No CORS issues**: All demo tracks are generated with oscillators (no external files)
- **Proper cleanup**: Audio nodes, streams, and animation frames are cleaned up on source switch
- **Mobile-friendly**: Handles AudioContext suspended state, visibility changes

### Canvas Rendering
- **Retina/HiDPI support**: Uses `devicePixelRatio` for crisp rendering
- **60fps**: Uses `requestAnimationFrame` for smooth animations
- **Efficient**: Only renders when tab is visible, stops when source changes

### Code Quality
- **Modular**: Single IIFE with clear separation of concerns
- **No global pollution**: All code scoped to module
- **Error handling**: Graceful fallbacks for missing APIs
- **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation

## Known Limitations

- **Demo tracks**: Generated with oscillators, not real music (no network dependency)
- **Microphone**: Requires HTTPS or localhost in production
- **Progress bar**: Hidden for generated tracks (no duration), ready for real audio files

## License

MIT

## Credits

Built with:
- Web Audio API
- Canvas 2D API
- Vanilla JavaScript
- Modern CSS (variables, flexbox, grid)
