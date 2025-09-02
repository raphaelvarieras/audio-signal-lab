// Visualization and canvas drawing functions

import { clamp, findDominantFrequency, computeFFT } from './utils.js';

// Auto-adjust time window based on frequency
export function getOptimalTimeWindow(frequency) {
  if (frequency < 1) return 1.0;
  
  // Show 2-4 cycles of the waveform
  const cyclesTarget = 3;
  const period = 1 / frequency;
  return period * cyclesTarget;
}

// Draw time-domain waveform with auto-scaling
export function drawTime(ctx, canvas, arr, autoScale = false, frequency = null) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  
  // Handle high-DPI
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  
  ctx.clearRect(0, 0, W, H);
  
  // Determine samples to display
  let samplesToShow = arr.length;
  let startIdx = 0;
  
  if (autoScale && frequency && frequency > 10) {
    // Auto-scale to show a few periods
    const sampleRate = 48000; // Assumed, should be passed
    const timeWindow = getOptimalTimeWindow(frequency);
    samplesToShow = Math.min(arr.length, Math.floor(timeWindow * sampleRate));
    
    // Try to find zero crossing for stable display
    startIdx = findZeroCrossing(arr, 0, true);
  }
  
  // Draw grid
  drawGrid(ctx, W, H);
  
  // Draw waveform
  ctx.strokeStyle = '#98c379';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  const mid = H / 2;
  for (let i = 0; i < samplesToShow; i++) {
    const idx = startIdx + i;
    if (idx >= arr.length) break;
    
    const x = (i / (samplesToShow - 1)) * W;
    const y = mid - arr[idx] * (H * 0.45);
    
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Draw midline
  ctx.strokeStyle = 'rgba(170,170,170,0.2)';
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(W, mid);
  ctx.stroke();
}

// Find zero crossing for stable oscilloscope display
function findZeroCrossing(arr, startSearch = 0, rising = true) {
  for (let i = startSearch + 1; i < arr.length - 1; i++) {
    if (rising) {
      if (arr[i - 1] <= 0 && arr[i] > 0) return i;
    } else {
      if (arr[i - 1] >= 0 && arr[i] < 0) return i;
    }
  }
  return startSearch;
}

// Draw frequency spectrum with axis labels
export function drawSpectrum(ctx, canvas, bins, sampleRate = 48000, zoomLevel = 1) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  
  ctx.clearRect(0, 0, W, H);
  
  // Calculate frequency range based on zoom
  const nyquist = sampleRate / 2;
  const maxFreq = nyquist / zoomLevel;
  const binsToShow = Math.floor(bins.length / zoomLevel);
  
  // Draw grid
  drawGrid(ctx, W, H, true);
  
  // Draw frequency axis labels
  ctx.fillStyle = '#8ca0b3';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  
  const numLabels = 10;
  for (let i = 0; i <= numLabels; i++) {
    const x = (i / numLabels) * W;
    const freq = (i / numLabels) * maxFreq;
    const label = freq >= 1000 ? `${(freq/1000).toFixed(1)}k` : `${Math.round(freq)}`;
    ctx.fillText(label, x, H - 2);
  }
  
  // Draw spectrum bars
  const barW = W / binsToShow;
  ctx.fillStyle = '#56b6c2';
  
  for (let i = 0; i < binsToShow && i < bins.length; i++) {
    const v = bins[i] / 255;
    const h = v * (H - 15); // Leave space for labels
    ctx.fillRect(i * barW, H - 15 - h, Math.max(1, barW - 1), h);
  }
  
  ctx.textAlign = 'left';
}

// Draw sampling points visualization
export function drawSamplingVisualization(ctx, canvas, signal, sampleRate, bitDepth, recordingRate, zoomLevel = 1) {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  
  ctx.clearRect(0, 0, W, H);
  
  // Draw grid with bit depth levels
  drawQuantizationGrid(ctx, W, H, bitDepth);
  
  // Calculate downsampling ratio
  const downsampleRatio = sampleRate / recordingRate;
  
  // Apply zoom level to control how many samples we show
  const samplesPerPixel = 2 / zoomLevel; // Fewer samples per pixel when zoomed in
  const samplesVisible = Math.min(signal.length, Math.floor(W * samplesPerPixel));
  const sampleStep = Math.max(1, Math.floor(downsampleRatio));
  
  // Draw continuous signal first (faded)
  ctx.strokeStyle = 'rgba(152, 195, 121, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  
  const mid = H / 2;
  for (let i = 0; i < samplesVisible; i++) {
    const x = (i / samplesVisible) * W;
    const y = mid - signal[i] * (H * 0.45);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  
  // Draw sampled points
  const quantLevels = Math.pow(2, bitDepth);
  const stepSize = 2 / quantLevels;
  
  ctx.fillStyle = '#e5c07b';
  ctx.strokeStyle = '#e5c07b';
  ctx.lineWidth = 1.5;
  
  // Draw sampled values as points and steps
  ctx.beginPath();
  let lastX = 0, lastY = mid;
  
  for (let i = 0; i < samplesVisible; i += sampleStep) {
    if (i >= signal.length) break;
    
    const x = (i / samplesVisible) * W;
    const value = signal[i];
    
    // Quantize the value
    const quantized = Math.round(value / stepSize) * stepSize;
    const y = mid - quantized * (H * 0.45);
    
    // Draw horizontal hold from last point
    if (i > 0) {
      ctx.lineTo(x, lastY);
      ctx.lineTo(x, y);
    } else {
      ctx.moveTo(x, y);
    }
    
    lastX = x;
    lastY = y;
  }
  
  // Complete the last hold
  if (lastX < W) {
    ctx.lineTo(W, lastY);
  }
  ctx.stroke();
  
  // Draw sample points as circles
  for (let i = 0; i < samplesVisible; i += sampleStep) {
    if (i >= signal.length) break;
    
    const x = (i / samplesVisible) * W;
    const value = signal[i];
    const quantized = Math.round(value / stepSize) * stepSize;
    const y = mid - quantized * (H * 0.45);
    
    // Draw point
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Draw info text
  ctx.fillStyle = '#8ca0b3';
  ctx.font = '11px monospace';
  ctx.fillText(`Sample Rate: ${recordingRate} Hz`, 10, 20);
  ctx.fillText(`Bit Depth: ${bitDepth}-bit (${quantLevels} levels)`, 10, 35);
  ctx.fillText(`Samples shown: ${Math.floor(samplesVisible / sampleStep)}`, 10, 50);
  ctx.fillText(`Zoom: ${zoomLevel.toFixed(1)}x`, 10, 65);
}

// Draw grid lines
function drawGrid(ctx, W, H, isFrequency = false) {
  ctx.strokeStyle = 'rgba(32, 38, 52, 0.5)';
  ctx.lineWidth = 0.5;
  
  // Vertical lines
  const vLines = 10;
  for (let i = 0; i <= vLines; i++) {
    const x = (i / vLines) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  
  // Horizontal lines
  const hLines = isFrequency ? 5 : 8;
  for (let i = 0; i <= hLines; i++) {
    const y = (i / hLines) * H;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

// Draw quantization grid showing bit depth levels
function drawQuantizationGrid(ctx, W, H, bitDepth) {
  const levels = Math.pow(2, bitDepth);
  const mid = H / 2;
  
  ctx.strokeStyle = 'rgba(32, 38, 52, 0.3)';
  ctx.lineWidth = 0.5;
  
  // Draw horizontal quantization levels
  for (let i = 0; i <= levels; i++) {
    const y = mid - ((i / levels - 0.5) * 2) * (H * 0.45);
    
    // Stronger line at zero
    if (i === levels / 2) {
      ctx.strokeStyle = 'rgba(170, 170, 170, 0.3)';
      ctx.lineWidth = 1;
    } else {
      ctx.strokeStyle = 'rgba(32, 38, 52, 0.3)';
      ctx.lineWidth = 0.5;
    }
    
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  
  // Vertical time grid
  const vLines = 20;
  ctx.strokeStyle = 'rgba(32, 38, 52, 0.2)';
  ctx.lineWidth = 0.5;
  
  for (let i = 0; i <= vLines; i++) {
    const x = (i / vLines) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
}

// Draw simple array to scope (for recorded data)
export function drawArrayToScope(canvas, arr, fs) {
  const ctx = canvas.getContext('2d');
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  
  if (canvas.width !== W || canvas.height !== H) {
    canvas.width = W;
    canvas.height = H;
  }
  
  ctx.clearRect(0, 0, W, H);
  
  // Draw grid
  drawGrid(ctx, W, H);
  
  ctx.strokeStyle = '#e5c07b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  
  const mid = H / 2;
  const N = arr.length;
  const step = Math.max(1, Math.floor(N / W));
  let idx = 0;
  let first = true;
  
  for (let x = 0; x < W; x++) {
    const i = Math.min(N - 1, idx);
    const y = mid - arr[i] * (H * 0.45);
    
    if (first) {
      ctx.moveTo(x, y);
      first = false;
    } else {
      ctx.lineTo(x, y);
    }
    idx += step;
  }
  ctx.stroke();
  
  // Midline
  ctx.strokeStyle = 'rgba(170, 170, 170, 0.2)';
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(W, mid);
  ctx.stroke();
}

// Create and manage visualization loop
export class VisualizationManager {
  constructor() {
    this.rafId = null;
    this.analysers = new Map();
    this.canvases = new Map();
    this.autoScaleSettings = new Map();
  }
  
  registerAnalyser(id, analyser, timeCanvas, freqCanvas, autoScale = false, spectrumZoom = 1) {
    this.analysers.set(id, {
      analyser,
      timeCanvas,
      freqCanvas,
      timeBuf: new Float32Array(analyser.fftSize),
      freqBuf: new Uint8Array(analyser.frequencyBinCount),
      spectrumZoom: spectrumZoom || 1
    });
    
    if (autoScale) {
      this.autoScaleSettings.set(id, true);
    }
  }
  
  unregisterAnalyser(id) {
    this.analysers.delete(id);
    this.autoScaleSettings.delete(id);
  }
  
  start() {
    if (this.rafId) return;
    
    const draw = () => {
      for (const [id, data] of this.analysers) {
        const { analyser, timeCanvas, freqCanvas, timeBuf, freqBuf } = data;
        
        if (timeCanvas) {
          analyser.getFloatTimeDomainData(timeBuf);
          const ctx = timeCanvas.getContext('2d');
          
          // Check if auto-scaling is enabled
          if (this.autoScaleSettings.get(id)) {
            // Compute dominant frequency for auto-scaling
            const fft = computeFFT(timeBuf);
            const freq = findDominantFrequency(fft, analyser.context.sampleRate);
            drawTime(ctx, timeCanvas, timeBuf, true, freq);
          } else {
            drawTime(ctx, timeCanvas, timeBuf, false);
          }
        }
        
        if (freqCanvas) {
          analyser.getByteFrequencyData(freqBuf);
          const ctx = freqCanvas.getContext('2d');
          const sampleRate = analyser.context.sampleRate;
          const zoomLevel = data.spectrumZoom || 1;
          drawSpectrum(ctx, freqCanvas, freqBuf, sampleRate, zoomLevel);
        }
      }
      
      this.rafId = requestAnimationFrame(draw);
    };
    
    draw();
  }
  
  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
  
  setAutoScale(id, enabled) {
    if (enabled) {
      this.autoScaleSettings.set(id, true);
    } else {
      this.autoScaleSettings.delete(id);
    }
  }
  
  setSpectrumZoom(id, zoomLevel) {
    const data = this.analysers.get(id);
    if (data) {
      data.spectrumZoom = zoomLevel;
    }
  }
}
