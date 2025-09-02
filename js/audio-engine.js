// Audio synthesis and processing engine

import { clamp, generateADSR, lerp } from './utils.js';

// Build a band-limited PeriodicWave for a given shape
export function buildPeriodicWave(ctx, shape, f0, phaseDeg, limitHarmonics = true) {
  const sr = ctx.sampleRate;
  // Calculate max harmonics - allow up to 90% of Nyquist to avoid sharp cutoff
  const nyquist = sr / 2;
  const maxFreq = nyquist * 0.9; // Use 90% of Nyquist
  const kMax = limitHarmonics ? Math.max(1, Math.floor(maxFreq / Math.max(1, f0))) : 256;
  
  // Use more array space to ensure we have room for all harmonics
  const arraySize = Math.max(kMax + 1, 8192);
  const real = new Float32Array(arraySize);
  const imag = new Float32Array(arraySize);
  const phi = (phaseDeg || 0) * Math.PI / 180;

  // Helper to set a sinusoid at harmonic k with magnitude A and phase phi
  function addHarm(k, A) {
    real[k] += A * Math.cos(phi);
    imag[k] += A * Math.sin(phi);
  }

  switch (shape) {
    case 'sine': {
      addHarm(1, 1.0);
      break;
    }
    case 'square': {
      const scale = 4 / Math.PI;
      // Include ALL odd harmonics up to the limit for proper square shape
      for (let n = 1; n <= kMax; n += 2) {
        // Apply gentle roll-off near Nyquist to avoid harsh cutoff
        const freq = n * f0;
        const nyquist = ctx.sampleRate / 2;
        let amplitude = scale * (1 / n);
        
        // Gentle roll-off starting at 80% of Nyquist
        if (freq > nyquist * 0.8) {
          const rolloff = 1 - ((freq - nyquist * 0.8) / (nyquist * 0.2));
          amplitude *= Math.max(0, rolloff);
        }
        
        if (amplitude > 0) {
          addHarm(n, amplitude);
        }
      }
      break;
    }
    case 'triangle': {
      const scale = 8 / (Math.PI * Math.PI);
      // Include all odd harmonics for proper triangle shape
      for (let n = 1; n <= kMax; n += 2) {
        const sign = ((n - 1) / 2) % 2 === 0 ? 1 : -1;
        const freq = n * f0;
        const nyquist = ctx.sampleRate / 2;
        let amplitude = scale * sign * (1 / (n * n));
        
        // Gentle roll-off near Nyquist
        if (freq > nyquist * 0.8) {
          const rolloff = 1 - ((freq - nyquist * 0.8) / (nyquist * 0.2));
          amplitude *= Math.max(0, rolloff);
        }
        
        if (Math.abs(amplitude) > 0.00001) {
          addHarm(n, amplitude);
        }
      }
      break;
    }
    case 'sawtooth': {
      const scale = 2 / Math.PI;
      for (let n = 1; n <= kMax; n++) {
        const sign = ((n + 1) % 2 === 0) ? 1 : -1;
        const freq = n * f0;
        const nyquist = ctx.sampleRate / 2;
        let amplitude = scale * sign * (1 / n);
        
        // Gentle roll-off near Nyquist
        if (freq > nyquist * 0.8) {
          const rolloff = 1 - ((freq - nyquist * 0.8) / (nyquist * 0.2));
          amplitude *= Math.max(0, rolloff);
        }
        
        if (Math.abs(amplitude) > 0.00001) {
          addHarm(n, amplitude);
        }
      }
      break;
    }
    default: {
      // For custom waveforms, fallback to sine
      addHarm(1, 1.0);
    }
  }
  
  return new PeriodicWave(ctx, { real, imag, disableNormalization: false });
}

// Create piano-like sound with ADSR envelope
export async function createPianoSound(ctx, frequency, duration, amplitude = 0.8) {
  const sampleRate = ctx.sampleRate;
  const samples = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, samples, sampleRate);
  const data = buffer.getChannelData(0);
  
  // Piano ADSR envelope
  const envelope = generateADSR(samples, sampleRate, {
    attack: 0.005,  // Very fast attack
    decay: 0.1,     // Quick decay
    sustain: 0.3,   // Low sustain level
    release: 0.5    // Moderate release
  });
  
  // Generate harmonics for piano-like timbre
  const harmonics = [
    { ratio: 1, amp: 1.0 },     // Fundamental
    { ratio: 2, amp: 0.5 },     // 2nd harmonic
    { ratio: 3, amp: 0.3 },     // 3rd harmonic
    { ratio: 4, amp: 0.2 },     // 4th harmonic
    { ratio: 5, amp: 0.15 },    // 5th harmonic
    { ratio: 6, amp: 0.1 },     // 6th harmonic
    { ratio: 7, amp: 0.08 },    // 7th harmonic
    { ratio: 8, amp: 0.05 }     // 8th harmonic
  ];
  
  for (let i = 0; i < samples; i++) {
    let sample = 0;
    const t = i / sampleRate;
    
    // Sum harmonics
    for (const h of harmonics) {
      const freq = frequency * h.ratio;
      // Add slight inharmonicity for realism (stretched tuning)
      const stretchedFreq = freq * Math.pow(1.0003, h.ratio);
      sample += h.amp * Math.sin(2 * Math.PI * stretchedFreq * t);
    }
    
    // Apply envelope and amplitude
    data[i] = sample * envelope[i] * amplitude * 0.3; // Scale down to prevent clipping
  }
  
  return buffer;
}

// Create violin-like sound with vibrato
export async function createViolinSound(ctx, frequency, duration, amplitude = 0.8) {
  const sampleRate = ctx.sampleRate;
  const samples = Math.floor(duration * sampleRate);
  const buffer = ctx.createBuffer(1, samples, sampleRate);
  const data = buffer.getChannelData(0);
  
  // Violin ADSR envelope (smooth bow attack)
  const envelope = generateADSR(samples, sampleRate, {
    attack: 0.08,   // Slightly faster attack for cleaner sound
    decay: 0.1,     // Gradual decay
    sustain: 0.7,   // Moderate sustain
    release: 0.3    // Natural release
  });
  
  // More realistic violin harmonics based on actual violin spectrum
  const harmonics = [
    { ratio: 1, amp: 1.0 },      // Fundamental
    { ratio: 2, amp: 0.45 },     // Octave
    { ratio: 3, amp: 0.3 },      // Fifth
    { ratio: 4, amp: 0.25 },     // Two octaves
    { ratio: 5, amp: 0.18 },     
    { ratio: 6, amp: 0.12 },    
    { ratio: 7, amp: 0.08 },     
    { ratio: 8, amp: 0.06 },    
    { ratio: 9, amp: 0.04 },     
    { ratio: 10, amp: 0.03 }    
  ];
  
  // More subtle vibrato
  const vibratoRate = 4.5;  // Hz (slightly slower)
  const vibratoDepth = 0.002; // 0.2% frequency modulation (more subtle)
  
  // Pre-calculate phase offsets for each harmonic (constant per buffer)
  const phaseOffsets = harmonics.map(() => Math.random() * 2 * Math.PI);
  
  for (let i = 0; i < samples; i++) {
    let sample = 0;
    const t = i / sampleRate;
    
    // Calculate vibrato with slight delay (vibrato starts after attack)
    const vibratoEnvelope = Math.min(1, t * 10); // Fade in vibrato
    const vibrato = 1 + vibratoDepth * vibratoEnvelope * Math.sin(2 * Math.PI * vibratoRate * t);
    
    // Sum harmonics with vibrato
    for (let j = 0; j < harmonics.length; j++) {
      const h = harmonics[j];
      const freq = frequency * h.ratio * vibrato;
      
      // Use pre-calculated phase offset for consistency
      sample += h.amp * Math.sin(2 * Math.PI * freq * t + phaseOffsets[j]);
    }
    
    // Add subtle bow noise in the attack phase
    if (t < 0.1) {
      sample += (Math.random() - 0.5) * 0.02 * (1 - t * 10);
    }
    
    // Apply envelope and amplitude with better scaling
    data[i] = sample * envelope[i] * amplitude * 0.4; // Better scaling
  }
  
  return buffer;
}

// Render offline from waves with support for custom waveforms
export async function renderOfflineFromWaves({ duration, sampleRate, waves, antiAliasMaxHarmonics = true, filter = null }) {
  const ctx = new OfflineAudioContext({
    numberOfChannels: 1,
    length: Math.ceil(duration * sampleRate),
    sampleRate
  });

  // Optional filter
  let dest = ctx.destination;
  if (filter && (filter.type === 'lowpass' || filter.type === 'highpass')) {
    const biq = new BiquadFilterNode(ctx, {
      type: filter.type,
      frequency: clamp(filter.cutoff || 18000, 10, sampleRate / 2 - 10),
      Q: 0.707
    });
    biq.connect(ctx.destination);
    dest = biq;
  }

  // Build oscillators and custom sounds
  for (const w of waves) {
    if (w.amp <= 0) continue;
    
    if (w.type === 'piano' || w.type === 'violin') {
      // Create custom buffer source
      let buffer;
      if (w.type === 'piano') {
        buffer = await createPianoSound(ctx, w.freq, duration, w.amp);
      } else {
        buffer = await createViolinSound(ctx, w.freq, duration, w.amp);
      }
      
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      
      // For piano, loop with retriggering
      if (w.type === 'piano') {
        source.loop = true;
        source.loopEnd = 1.0; // Loop every second for piano stroke repetition
      } else {
        source.loop = true; // Continuous for violin
      }
      
      const gain = new GainNode(ctx, { gain: 1.0 });
      source.connect(gain).connect(dest);
      source.start(0);
      source.stop(duration);
    } else {
      // Standard waveforms
      const osc = new OscillatorNode(ctx, {
        type: 'sine',
        frequency: clamp(w.freq, 1, sampleRate / 2 - 1)
      });
      
      const gain = new GainNode(ctx, { gain: w.amp });
      
      const pw = buildPeriodicWave(ctx, w.type, w.freq, w.phaseDeg, antiAliasMaxHarmonics);
      if (pw) {
        osc.setPeriodicWave(pw);
      } else {
        osc.type = w.type;
      }
      
      osc.connect(gain).connect(dest);
      osc.start(0);
      osc.stop(duration);
    }
  }

  const buf = await ctx.startRendering();
  return buf;
}

// Quantization with optional dithering and compression
export function quantizeBuffer(xFloat, { bits, dither = false, compression = 'None' }) {
  const N = xFloat.length;
  const qFloat = new Float32Array(N);
  const errFloat = new Float32Array(N);
  let pcm = null;
  let ulaw = null;

  if (compression.startsWith('μ')) {
    // μ-law 8-bit companding
    ulaw = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = clamp(xFloat[i], -1, 1);
      const sign = x < 0 ? -1 : 1;
      const mu = 255;
      const y = sign * (Math.log(1 + mu * Math.abs(x)) / Math.log(1 + mu));
      const val = Math.round((y + 1) * 127.5);
      ulaw[i] = clamp(val, 0, 255);
      const yDec = ((ulaw[i] / 127.5) - 1);
      const xRec = signMuLawInverse(yDec, mu);
      qFloat[i] = xRec;
      errFloat[i] = x - xRec;
    }
    pcm = ulaw;
    return { qFloat, errFloat, pcm, encLabel: 'μ-law8', ulaw };
  }

  // Linear PCM
  const peak = Math.pow(2, bits - 1) - 1;
  const step = 1 / peak;
  let arr;
  if (bits === 8) arr = new Int8Array(N);
  else if (bits === 16) arr = new Int16Array(N);
  else arr = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    let v = clamp(xFloat[i], -1, 1);
    if (dither) {
      // TPDF dither
      v += (Math.random() + Math.random() - 1) * step;
      v = clamp(v, -1, 1);
    }
    const q = Math.round(v * peak);
    arr[i] = q;
    const qv = q / peak;
    qFloat[i] = qv;
    errFloat[i] = v - qv;
  }
  pcm = arr;
  return { qFloat, errFloat, pcm, encLabel: `${bits}-bit PCM`, ulaw: null };
}

function signMuLawInverse(y, mu) {
  const sign = (y < 0) ? -1 : 1;
  const ay = Math.abs(y);
  const x = sign * ((Math.pow(1 + mu, ay) - 1) / mu);
  return clamp(x, -1, 1);
}

// Compute Signal-to-Noise Ratio
export function computeSNR(x, y) {
  let pSig = 0, pErr = 0;
  const N = x.length;
  for (let i = 0; i < N; i++) {
    const s = x[i];
    const e = x[i] - y[i];
    pSig += s * s;
    pErr += e * e;
  }
  if (pErr <= 1e-20) return Infinity;
  return 10 * Math.log10(pSig / pErr);
}

// DAC Reconstruction
export function reconstructDAC(q, fsIn, fsOut, methodLabel) {
  const duration = q.length / fsIn;
  const Nout = Math.floor(duration * fsOut);
  const y = new Float32Array(Nout);
  const linear = methodLabel.startsWith('Linear');

  for (let i = 0; i < Nout; i++) {
    const t = i / fsOut;
    const n = t * fsIn;
    const n0 = Math.floor(n);
    const frac = n - n0;
    
    if (n0 < 0 || n0 >= q.length) {
      y[i] = 0;
      continue;
    }
    
    if (!linear || n0 === q.length - 1) {
      y[i] = q[n0];
    } else {
      const n1 = n0 + 1;
      y[i] = q[n0] * (1 - frac) + q[n1] * frac;
    }
  }
  return y;
}

// Simple one-pole low-pass filter
export function onePoleLowpass(x, fs, cutoff) {
  const y = new Float32Array(x.length);
  const dt = 1 / fs;
  const RC = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (RC + dt);
  let prev = 0;
  
  for (let i = 0; i < x.length; i++) {
    prev = prev + alpha * (x[i] - prev);
    y[i] = prev;
  }
  return y;
}

