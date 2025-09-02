# Audio Signal Lab

An interactive web-based tool for exploring digital signal processing concepts including sampling, quantization, and reconstruction.

## Features

### 🎵 Waveform Generation
- **Standard Waveforms**: Sine, Square, Triangle, Sawtooth (band-limited to prevent aliasing)
- **Instrument Sounds**: Piano (percussive strikes) and Violin (sustained with vibrato)
- **Adjustable Parameters**: Amplitude, frequency, phase for each waveform
- **Multi-waveform Mixing**: Combine multiple waveforms to create complex signals

### 📊 Visualization
- **Oscilloscope**: Time-domain visualization with auto-scaling to waveform frequency
- **Spectrum Analyzer**: Frequency-domain visualization showing harmonic content
- **Sampling Visualization**: Shows actual sample points and quantization levels
- **Quantization Error Display**: Visualizes the difference between original and quantized signals

### 🎚️ Signal Processing
- **Adjustable Sample Rates**: 8kHz to 96kHz
- **Variable Bit Depths**: 8-bit, 16-bit, 24-bit
- **Anti-aliasing Filters**: Low-pass and high-pass options
- **Dithering**: TPDF dithering for improved quantization
- **Compression**: μ-law companding (G.711) support

### 🔊 Audio Features
- **A/B Comparison**: Instantly toggle between input and output signals
- **WAV Export**: Download recordings as standard WAV files
- **Real-time Playback**: Hear the effects of your processing choices
- **DAC Simulation**: Zero-order hold and linear interpolation methods

### 📱 Responsive Design
- **Mobile Optimized**: Touch-friendly interface that works on phones and tablets
- **Desktop Enhanced**: Full feature set with detailed visualizations
- **Dark Theme**: Easy on the eyes for extended use

## How to Use

1. **Enable Audio**: Click the "Enable Audio" button to initialize the Web Audio API
2. **Build Your Signal**: Add and configure waveforms in Step 1
3. **Simulate Recording**: Choose sample rate, bit depth, and filters in Step 2
4. **Reconstruct Signal**: Apply DAC simulation and filtering in Step 3
5. **Compare Results**: Use the A/B toggle to hear the difference between original and processed signals

## Technical Implementation

### Architecture
- **Modular ES6 Design**: Separated into logical modules for maintainability
- **Web Audio API**: Leverages modern browser audio capabilities
- **Offline Rendering**: High-quality signal generation using OfflineAudioContext
- **Canvas Visualization**: Hardware-accelerated graphics for smooth animations

### Files Structure
```
audio-signal-lab/
├── index.html          # Main HTML structure
├── styles.css          # Responsive styling
├── js/
│   ├── main.js         # Application logic and UI management
│   ├── audio-engine.js # Audio synthesis and processing
│   ├── visualization.js # Canvas drawing and animations
│   ├── wav-encoder.js  # WAV file generation
│   └── utils.js        # Utility functions
```

## Educational Use Cases

- **Digital Signal Processing**: Demonstrate sampling theorem and Nyquist frequency
- **Audio Engineering**: Show effects of bit depth and sample rate on audio quality
- **Music Production**: Understand how digital audio works under the hood
- **Computer Science**: Visualize quantization and data compression techniques

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14.1+
- Mobile browsers with Web Audio API support

## Local Development

To run the application locally:

```bash
# Clone the repository
git clone https://github.com/yourusername/audio-signal-lab.git

# Navigate to the directory
cd audio-signal-lab

# Start a local server (Python 3)
python3 -m http.server 8080

# Or using Node.js
npx http-server -p 8080

# Open in browser
# Navigate to http://localhost:8080
```

## Learning Resources

### Key Concepts
- **Nyquist-Shannon Sampling Theorem**: Signals must be sampled at least twice their highest frequency
- **Quantization**: Converting continuous amplitude values to discrete levels
- **Signal-to-Noise Ratio**: Approximately 6.02N + 1.76 dB for N-bit quantization
- **Aliasing**: Frequency folding when sampling below Nyquist rate
- **Dithering**: Adding noise to reduce quantization artifacts

### Experiments to Try
1. Create a 10kHz sine wave and sample at 16kHz to observe aliasing
2. Compare 8-bit vs 16-bit recording of the same signal
3. Use the piano waveform to understand attack-decay-sustain-release envelopes
4. Apply different anti-aliasing filters and observe their effects
5. Toggle A/B comparison to hear subtle differences in processing

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## Acknowledgments

Built with Web Audio API and modern JavaScript for educational purposes. Inspired by the need for interactive tools in digital signal processing education.