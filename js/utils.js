// Utility functions

export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const dB = x => 20 * Math.log10(x);
export const fmt = (x, digits = 2) => Number.isFinite(x) ? x.toFixed(digits) : '—';

export function bytesHuman(n) {
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0, v = n;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(2)} ${u[i]}`;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function findDominantFrequency(fftData, sampleRate) {
  // Find peak in FFT magnitude data
  let maxMag = 0;
  let maxBin = 0;
  
  for (let i = 1; i < fftData.length / 2; i++) {
    if (fftData[i] > maxMag) {
      maxMag = fftData[i];
      maxBin = i;
    }
  }
  
  const binWidth = sampleRate / fftData.length;
  return maxBin * binWidth;
}

export function nextPowerOf2(n) {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

// Debounce function for responsive controls
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Check if on mobile device
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768;
}

// Format frequency for display
export function formatFrequency(freq) {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)}k`;
  }
  return `${Math.round(freq)}`;
}

// Generate ADSR envelope
export function generateADSR(length, sampleRate, params) {
  const { attack, decay, sustain, release } = params;
  const envelope = new Float32Array(length);
  
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const releaseSamples = Math.floor(release * sampleRate);
  const sustainSamples = length - attackSamples - decaySamples - releaseSamples;
  
  let i = 0;
  
  // Attack phase
  for (let j = 0; j < attackSamples && i < length; j++, i++) {
    envelope[i] = j / attackSamples;
  }
  
  // Decay phase
  for (let j = 0; j < decaySamples && i < length; j++, i++) {
    envelope[i] = 1.0 - (1.0 - sustain) * (j / decaySamples);
  }
  
  // Sustain phase
  for (let j = 0; j < sustainSamples && i < length; j++, i++) {
    envelope[i] = sustain;
  }
  
  // Release phase
  for (let j = 0; j < releaseSamples && i < length; j++, i++) {
    envelope[i] = sustain * (1 - j / releaseSamples);
  }
  
  return envelope;
}

// Simple FFT for frequency analysis (for auto-scaling scope)
export function computeFFT(signal) {
  const n = nextPowerOf2(signal.length);
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  
  // Copy signal to real part
  for (let i = 0; i < signal.length; i++) {
    real[i] = signal[i];
  }
  
  // Simple DFT (not optimized, but works for our needs)
  const output = new Float32Array(n);
  for (let k = 0; k < n / 2; k++) {
    let sumReal = 0;
    let sumImag = 0;
    for (let t = 0; t < n; t++) {
      const angle = -2 * Math.PI * k * t / n;
      sumReal += real[t] * Math.cos(angle);
      sumImag += real[t] * Math.sin(angle);
    }
    output[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
  }
  
  return output;
}

// Create a simple low-pass filter coefficient
export function createLowPassCoefficients(cutoff, sampleRate) {
  const nyquist = sampleRate / 2;
  const normalizedCutoff = cutoff / nyquist;
  
  // Simple RC filter coefficient
  const RC = 1 / (2 * Math.PI * cutoff);
  const dt = 1 / sampleRate;
  const alpha = dt / (RC + dt);
  
  return { alpha };
}

