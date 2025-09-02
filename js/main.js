// Main application logic

import { clamp, bytesHuman, fmt, debounce, isMobile } from './utils.js';
import { 
  renderOfflineFromWaves, 
  quantizeBuffer, 
  computeSNR, 
  reconstructDAC, 
  onePoleLowpass 
} from './audio-engine.js';
import { 
  drawArrayToScope, 
  drawSamplingVisualization,
  VisualizationManager 
} from './visualization.js';
import { encodeWavFromPCM, encodeWavFromULaw } from './wav-encoder.js';

// Global State
let audioCtx = null;
let mainOut = null;
let analyser1 = null;
let analyser3 = null;
let previewSrc = null;
let previewBuf = null;
let recorded = null;
let recordedSrc = null;
let dacSrc = null;
let dacGainNode = null;
let dacBuf = null;

// A/B Toggle State
let abMode = 'A'; // 'A' = input/original, 'B' = output/processed
let abSourceA = null;
let abSourceB = null;

const vizManager = new VisualizationManager();

const state = {
  waveforms: [],
  masterGain: 0.8,
  previewDur: 2.0,
  autoScaleScope: true
};

let nextWaveId = 1;

// DOM Elements
const el = id => document.getElementById(id);

// Initialize all DOM element references
function initDOM() {
  return {
    ctxRate: el('ctxRate'),
    wavesDiv: el('waves'),
    addWaveBtn: el('addWave'),
    enableAudioBtn: el('enableAudio'),
    signalStatus: el('signalStatus'),
    dacStatus: el('dacStatus'),
    previewDurInput: el('previewDur'),
    masterGainInput: el('masterGain'),
    scope1: el('scope1'),
    spec1: el('spec1'),
    autoScaleToggle: el('autoScaleToggle'),
    spectrumZoom: el('spectrumZoom'),
    
    // A/B Toggle
    abToggleSection: el('abToggleSection'),
    abToggleA: el('abToggleA'),
    abToggleB: el('abToggleB'),
    abPlayBtn: el('abPlay'),
    abStopBtn: el('abStop'),
    
    // Recording controls
    recRateSel: el('recRate'),
    bitDepthSel: el('bitDepth'),
    channelsSel: el('channels'),
    recDurInput: el('recDur'),
    aaKindSel: el('aaKind'),
    aaCutoffInput: el('aaCutoff'),
    ditherSel: el('dither'),
    compressionSel: el('compression'),
    size1minBox: el('size1min'),
    snrBox: el('snrBox'),
    scope2: el('scope2'),
    err2: el('err2'),
    samplingViz: el('samplingViz'),
    samplingZoom: el('samplingZoom'),
    downloadWavBtn: el('downloadWav'),
    
    // DAC controls
    dacMethodSel: el('dacMethod'),
    dacLPInput: el('dacLP'),
    dacGainInput: el('dacGain'),
    scope3: el('scope3'),
    spec3: el('spec3')
  };
}

let dom = null;

// Audio initialization
async function initAudio() {
  console.log('initAudio called');
  if (!audioCtx) {
    console.log('Creating new AudioContext...');
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    mainOut = audioCtx.createGain();
    mainOut.gain.value = state.masterGain;
    mainOut.connect(audioCtx.destination);

    analyser1 = audioCtx.createAnalyser();
    analyser1.fftSize = 4096;
    analyser1.smoothingTimeConstant = 0.2;

    analyser3 = audioCtx.createAnalyser();
    analyser3.fftSize = 4096;
    analyser3.smoothingTimeConstant = 0.2;

    dacGainNode = audioCtx.createGain();
    dacGainNode.gain.value = parseFloat(dom.dacGainInput.value);
    dacGainNode.connect(analyser3);
    analyser3.connect(mainOut);

    dom.ctxRate.textContent = `Context: ${audioCtx.sampleRate} Hz`;
    
    // Disable enable button
    dom.enableAudioBtn.disabled = true;
    
    // Start auto-generation if we have waveforms
    if (state.waveforms.length > 0) {
      console.log('Starting auto-generation of signals...');
      setTimeout(() => {
        generateAllSignals().then(() => {
          console.log('Initial signal generation completed');
        }).catch(e => {
          console.error('Error in initial signal generation:', e);
        });
      }, 100);
    }
    
    // Register visualizers
    vizManager.registerAnalyser('step1', analyser1, dom.scope1, dom.spec1, state.autoScaleScope, 1);
    vizManager.registerAnalyser('step3', analyser3, dom.scope3, dom.spec3, false, 1);
    
    console.log('Audio initialization complete');
  } else {
    console.log('AudioContext already exists');
  }
}

// Waveform management
function addWave(w = { type: 'sine', amp: 0.8, freq: 440, phaseDeg: 0 }) {
  console.log('Adding waveform:', w);
  state.waveforms.push({ id: nextWaveId++, ...w });
  console.log('Total waveforms:', state.waveforms.length);
}

function removeWave(id) {
  state.waveforms = state.waveforms.filter(w => w.id !== id);
  renderWaves();
}

function renderWaves() {
  console.log('renderWaves called, waveforms:', state.waveforms.length);
  
  if (!state.waveforms.length) {
    console.log('No waveforms, adding default');
    addWave({ type: 'sine', amp: 0.6, freq: 440, phaseDeg: 0 });
    return; // Exit early to prevent recursion
  }
  
  if (!dom.wavesDiv) {
    console.error('wavesDiv not found!');
    return;
  }
  
  dom.wavesDiv.innerHTML = '';
  console.log('Cleared wavesDiv, rendering', state.waveforms.length, 'waveforms');
  
  state.waveforms.forEach((w, index) => {
    console.log('Rendering waveform', index, ':', w);
    const row = document.createElement('div');
    row.className = 'card wave-row';
    
    // Create mobile-friendly layout
    let isMobileDevice = false;
    try {
      isMobileDevice = isMobile();
    } catch (e) {
      console.warn('isMobile() failed:', e);
    }
    
    if (isMobileDevice) {
      row.innerHTML = `
        <div class="wave-controls">
          <label>
            Shape
            <select data-k="type" data-id="${w.id}">
              <option ${w.type==='sine'?'selected':''}>sine</option>
              <option ${w.type==='square'?'selected':''}>square</option>
              <option ${w.type==='triangle'?'selected':''}>triangle</option>
              <option ${w.type==='sawtooth'?'selected':''}>sawtooth</option>
              <option ${w.type==='piano'?'selected':''}>piano</option>
              <option ${w.type==='violin'?'selected':''}>violin</option>
            </select>
          </label>
          <label>
            Amplitude
            <input type="number" step="0.01" min="0" max="1" value="${w.amp}" data-k="amp" data-id="${w.id}">
          </label>
        </div>
        <div class="wave-controls">
          <label>
            Frequency (Hz)
            <input type="number" step="1" min="1" max="20000" value="${w.freq}" data-k="freq" data-id="${w.id}">
          </label>
          <label>
            Phase (°)
            <input type="number" step="1" min="0" max="360" value="${w.phaseDeg}" data-k="phaseDeg" data-id="${w.id}">
          </label>
        </div>
        <div class="wave-actions">
          <button class="danger" data-act="del" data-id="${w.id}">Delete</button>
        </div>
      `;
    } else {
      row.innerHTML = `
        <div class="mini">
          <label>
            Shape
            <select data-k="type" data-id="${w.id}">
              <option ${w.type==='sine'?'selected':''}>sine</option>
              <option ${w.type==='square'?'selected':''}>square</option>
              <option ${w.type==='triangle'?'selected':''}>triangle</option>
              <option ${w.type==='sawtooth'?'selected':''}>sawtooth</option>
              <option ${w.type==='piano'?'selected':''}>piano</option>
              <option ${w.type==='violin'?'selected':''}>violin</option>
            </select>
          </label>
        </div>
        <label>
          Amplitude
          <input type="number" step="0.01" min="0" max="1" value="${w.amp}" data-k="amp" data-id="${w.id}">
        </label>
        <label>
          Frequency (Hz)
          <input type="number" step="1" min="1" max="20000" value="${w.freq}" data-k="freq" data-id="${w.id}">
        </label>
        <label>
          Phase (°)
          <input type="number" step="1" min="0" max="360" value="${w.phaseDeg}" data-k="phaseDeg" data-id="${w.id}">
        </label>
        <div class="mini">
          <button class="danger" data-act="del" data-id="${w.id}">Delete</button>
        </div>
      `;
    }
    
    try {
      dom.wavesDiv.appendChild(row);
      console.log('Successfully added waveform row', index);
    } catch (e) {
      console.error('Failed to append waveform row:', e);
    }
  });
  
  console.log('Finished rendering waveforms, attaching handlers...');

  // Attach handlers
  try {
    dom.wavesDiv.querySelectorAll('select, input').forEach(ctrl => {
    ctrl.addEventListener('input', ev => {
      const id = Number(ev.target.dataset.id);
      const k = ev.target.dataset.k;
      const w = state.waveforms.find(x => x.id === id);
      if (!w) return;
      
      if (k === 'amp' || k === 'freq' || k === 'phaseDeg') {
        w[k] = parseFloat(ev.target.value);
      } else if (k === 'type') {
        w.type = ev.target.value;
      }
      
        if (audioCtx) scheduleGeneration();
        updateSizeBox();
      });
    });
    
    dom.wavesDiv.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', ev => {
      const id = Number(ev.target.dataset.id);
      const act = ev.target.dataset.act;
      const w = state.waveforms.find(x => x.id === id);
      if (!w) return;
      
        if (act === 'del') removeWave(id);
      });
    });
    
    console.log('Event handlers attached successfully');
  } catch (e) {
    console.error('Failed to attach event handlers:', e);
  }
}

// Update storage size display
function updateSizeBox() {
  const fs = parseInt(dom.recRateSel.value, 10);
  const bits = parseInt(dom.bitDepthSel.value, 10);
  const ch = (dom.channelsSel.value === 'Mono') ? 1 : 2;
  const perMinuteBytes = 60 * fs * (bits / 8) * ch;
  dom.size1minBox.textContent = `${bytesHuman(perMinuteBytes)} / minute  (${ch} ch · ${fs.toLocaleString()} Hz · ${bits}-bit PCM)`;
}

// Recording is now part of generateAllSignals

// Generate all signals (preview, recording, DAC)
async function generateAllSignals() {
  console.log('generateAllSignals called, audioCtx:', !!audioCtx, 'waveforms:', state.waveforms.length);
  
  if (!audioCtx || !state.waveforms.length) {
    console.log('Cannot generate signals - missing audioCtx or waveforms');
    return;
  }

  console.log('Step 1: Generating preview buffer...');
  // Step 1: Generate preview buffer
  previewBuf = await renderOfflineFromWaves({
    duration: state.previewDur,
    sampleRate: audioCtx.sampleRate,
    waves: state.waveforms,
    antiAliasMaxHarmonics: true
  });

  // Store for A/B comparison
  abSourceA = previewBuf;
  console.log('abSourceA created:', !!abSourceA);
  
  // Connect to analyzer for visualization (but don't play)
  if (previewSrc) {
    try { previewSrc.stop(); } catch {}
    previewSrc.disconnect();
  }
  
  previewSrc = audioCtx.createBufferSource();
  previewSrc.buffer = previewBuf;
  previewSrc.loop = true;
  
  const silentGain = audioCtx.createGain();
  silentGain.gain.value = 0; // Silent - just for visualization
  previewSrc.connect(analyser1);
  analyser1.connect(silentGain);
  silentGain.connect(mainOut);
  previewSrc.start();
  
  vizManager.start();
  
  console.log('Step 2: Simulating recording...');
  // Step 2: Simulate recording
  await simulateRecording();
  
  console.log('Step 3: Rendering DAC...');
  // Step 3: Render DAC
  await renderDAC();
  
  console.log('abSourceB created:', !!abSourceB);
  
  // Update status indicators
  if (dom.signalStatus) {
    dom.signalStatus.classList.add('active');
  }
  if (dom.dacStatus) {
    dom.dacStatus.classList.add('active');
  }
  
  console.log('generateAllSignals completed successfully');
}

// Step 2: Recording simulation
async function simulateRecording() {
  if (!audioCtx || !state.waveforms.length) return;

  const duration = parseFloat(dom.recDurInput.value);
  const fs = parseInt(dom.recRateSel.value, 10);
  const bits = parseInt(dom.bitDepthSel.value, 10);
  const ch = (dom.channelsSel.value === 'Mono') ? 1 : 2;
  const aaKind = dom.aaKindSel.value;
  const cutoff = parseFloat(dom.aaCutoffInput.value);
  const useDither = (dom.ditherSel.value === 'On');
  const compression = dom.compressionSel.value;

  // Render "analog" at recording fs
  const analogBuf = await renderOfflineFromWaves({
    duration,
    sampleRate: fs,
    waves: state.waveforms,
    antiAliasMaxHarmonics: true,
    filter: (aaKind === 'None') ? null : {
      type: (aaKind === 'Low-pass') ? 'lowpass' : 'highpass',
      cutoff
    }
  });
  
  const x = analogBuf.getChannelData(0);
  const xR = (ch === 2) ? x.slice(0) : null;

  // Quantize
  const { qFloat, errFloat, pcm, encLabel, ulaw } = quantizeBuffer(x, {
    bits,
    dither: useDither,
    compression
  });

  // Measured SNR
  const snr = computeSNR(x, qFloat);
  const theory = 6.02 * (compression.startsWith('μ') ? 8 : bits) + 1.76;
  dom.snrBox.innerHTML = `Measured SNR: <strong>${fmt(snr, 1)} dB</strong><br/>Theoretical (~sine): <span class="mono">${fmt(theory, 1)} dB</span>`;

  recorded = {
    fs,
    bitDepth: bits,
    ch,
    duration,
    float: x,
    floatR: xR,
    quantFloat: qFloat,
    errFloat,
    pcm,
    encoding: encLabel,
    ulaw
  };

  // Visualizations
  drawArrayToScope(dom.scope2, recorded.quantFloat, fs);
  drawArrayToScope(dom.err2, recorded.errFloat, fs);
  
  // Draw sampling visualization
  const samplingCtx = dom.samplingViz.getContext('2d');
  const zoomLevel = dom.samplingZoom ? (parseFloat(dom.samplingZoom.value) || 1) : 1;
  drawSamplingVisualization(samplingCtx, dom.samplingViz, x, audioCtx.sampleRate, bits, fs, zoomLevel);

  // Prepare preview BufferSource
  if (audioCtx) {
    recordedSrc = audioCtx.createBuffer(ch, x.length, fs);
    if (ch === 1) {
      recordedSrc.getChannelData(0).set(recorded.quantFloat);
    } else {
      recordedSrc.getChannelData(0).set(recorded.quantFloat);
      recordedSrc.getChannelData(1).set(recorded.quantFloat);
    }
  }

  // Enable WAV download
  dom.downloadWavBtn.disabled = false;
}

// Remove unused playback functions for Step 2

function downloadWav() {
  if (!recorded) return;
  
  const blob = (recorded.encoding.startsWith('μ-law'))
    ? encodeWavFromULaw(recorded.ulaw, recorded.fs, recorded.ch)
    : encodeWavFromPCM(recorded.quantFloat, recorded.fs, recorded.bitDepth, recorded.ch);

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `recorded_${recorded.fs}Hz_${recorded.encoding.replace(/\s+/g, '')}.wav`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Step 3: DAC reconstruction
async function renderDAC() {
  if (!audioCtx || !recorded) return;

  const method = dom.dacMethodSel.value;
  const lpHz = parseFloat(dom.dacLPInput.value);
  const fsOut = audioCtx.sampleRate;
  const fsIn = recorded.fs;

  const y = reconstructDAC(recorded.quantFloat, fsIn, fsOut, method);
  const yLP = (lpHz > 0) ? onePoleLowpass(y, fsOut, lpHz) : y;

  // Store DAC buffer for A/B comparison
  dacBuf = audioCtx.createBuffer(1, yLP.length, fsOut);
  dacBuf.getChannelData(0).set(yLP);
  
  // Don't actually play here - just prepare the buffer
  // The A/B toggle will handle playback
  
  // Store for A/B comparison
  abSourceB = dacBuf;
}

// A/B Toggle functionality  

function setABMode(mode) {
  abMode = mode;
  if (mode === 'A') {
    dom.abToggleA.classList.add('active');
    dom.abToggleB.classList.remove('active');
  } else {
    dom.abToggleA.classList.remove('active');
    dom.abToggleB.classList.add('active');
  }
}

let abCurrentSource = null;

function playAB() {
  console.log('playAB called, audioCtx:', !!audioCtx, 'abSourceA:', !!abSourceA, 'abSourceB:', !!abSourceB);
  
  if (!audioCtx) {
    console.log('No audio context available');
    return;
  }
  
  // Generate signals if not ready
  if (!abSourceA || !abSourceB) {
    console.log('Sources not ready, generating signals...');
    generateAllSignals().then(() => {
      console.log('Signals generated, trying playAB again...');
      // Try again after generation
      if (abSourceA && abSourceB) {
        playAB();
      } else {
        console.log('Sources still not available after generation');
      }
    }).catch(e => {
      console.error('Error generating signals:', e);
    });
    return;
  }
  
  stopAB();
  
  const source = audioCtx.createBufferSource();
  source.buffer = (abMode === 'A') ? abSourceA : abSourceB;
  source.loop = true;
  
  const gain = audioCtx.createGain();
  gain.gain.value = state.masterGain;
  
  // Connect to appropriate analyzer
  if (abMode === 'A') {
    source.connect(gain);
    gain.connect(analyser1);
    analyser1.connect(audioCtx.destination);
  } else {
    source.connect(gain);
    gain.connect(analyser3);
    analyser3.connect(audioCtx.destination);
  }
  
  source.start();
  abCurrentSource = source;
  
  vizManager.start();
}

function stopAB() {
  console.log('stopAB called, abCurrentSource:', abCurrentSource);
  try { 
    if (abCurrentSource) {
      abCurrentSource.stop();
      console.log('Audio source stopped');
    }
  } catch (e) {
    console.log('Error stopping audio source:', e);
  }
  
  if (abCurrentSource) {
    abCurrentSource.disconnect();
    console.log('Audio source disconnected');
  }
  
  abCurrentSource = null;
  console.log('stopAB completed');
}

// Auto generation scheduling
let generationTimer = null;
function scheduleGeneration() {
  if (!audioCtx) return;
  if (generationTimer) clearTimeout(generationTimer);
  generationTimer = setTimeout(() => generateAllSignals(), 250);
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing Audio Lab...');
  
  try {
    dom = initDOM();
    console.log('DOM initialized successfully');
  } catch (e) {
    console.error('Failed to initialize DOM:', e);
    return;
  }
  
  // Setup event listeners
  if (dom.enableAudioBtn) {
    console.log('Setting up Enable Audio button');
    dom.enableAudioBtn.addEventListener('click', () => {
      console.log('Enable Audio clicked');
      initAudio();
    });
  } else {
    console.error('Enable Audio button not found!');
  }
  
  if (dom.addWaveBtn) {
    console.log('Setting up Add Waveform button');
    dom.addWaveBtn.addEventListener('click', () => {
      console.log('Add Waveform clicked');
      try {
        addWave();
        renderWaves();
        if (audioCtx) scheduleGeneration();
      } catch (e) {
        console.error('Error in addWave click handler:', e);
      }
    });
  } else {
    console.error('Add Waveform button not found!');
  }
  
  // Step 1 controls
  if (dom.previewDurInput) {
    dom.previewDurInput.addEventListener('input', () => {
      state.previewDur = parseFloat(dom.previewDurInput.value);
      if (audioCtx) scheduleGeneration();
    });
  }
  
  if (dom.masterGainInput) {
    dom.masterGainInput.addEventListener('input', () => {
      state.masterGain = parseFloat(dom.masterGainInput.value);
      if (mainOut) mainOut.gain.setTargetAtTime(state.masterGain, audioCtx.currentTime, 0.01);
    });
  }
  
  // Auto-scale toggle
  if (dom.autoScaleToggle) {
    dom.autoScaleToggle.addEventListener('change', () => {
      state.autoScaleScope = dom.autoScaleToggle.checked;
      vizManager.setAutoScale('step1', state.autoScaleScope);
    });
  }
  
  // Spectrum zoom control
  if (dom.spectrumZoom) {
    dom.spectrumZoom.addEventListener('input', () => {
      const zoomLevel = parseFloat(dom.spectrumZoom.value);
      vizManager.setSpectrumZoom('step1', zoomLevel);
      vizManager.setSpectrumZoom('step3', zoomLevel);
    });
  }
  
  // A/B Toggle controls
  if (dom.abToggleA) {
    dom.abToggleA.addEventListener('click', () => {
      setABMode('A');
      if (abCurrentSource) playAB(); // Switch immediately if playing
    });
  }
  
  if (dom.abToggleB) {
    dom.abToggleB.addEventListener('click', () => {
      setABMode('B');
      if (abCurrentSource) playAB(); // Switch immediately if playing
    });
  }
  
  if (dom.abPlayBtn) {
    dom.abPlayBtn.addEventListener('click', () => {
      console.log('Play button clicked');
      playAB();
    });
  }
  
  if (dom.abStopBtn) {
    dom.abStopBtn.addEventListener('click', () => {
      console.log('Stop button clicked');
      stopAB();
    });
  } else {
    console.error('Stop button not found!');
  }
  
  // Step 2 controls - auto-update on any change
  [dom.recRateSel, dom.bitDepthSel, dom.channelsSel, dom.recDurInput,
   dom.aaKindSel, dom.aaCutoffInput, dom.ditherSel, dom.compressionSel].forEach(ctrl => {
    ctrl.addEventListener('input', () => {
      updateSizeBox();
      if (audioCtx) scheduleGeneration();
    });
  });
  
  // Sampling zoom control
  if (dom.samplingZoom) {
    dom.samplingZoom.addEventListener('input', () => {
      if (recorded) {
        const samplingCtx = dom.samplingViz.getContext('2d');
        const zoomLevel = parseFloat(dom.samplingZoom.value) || 1;
        drawSamplingVisualization(samplingCtx, dom.samplingViz, 
          recorded.float, audioCtx.sampleRate, recorded.bitDepth, recorded.fs, zoomLevel);
      }
    });
  }
  
  dom.downloadWavBtn.addEventListener('click', downloadWav);
  
  // Step 3 controls
  [dom.dacMethodSel, dom.dacLPInput].forEach(ctrl => {
    ctrl.addEventListener('input', () => {
      if (audioCtx) scheduleGeneration();
    });
  });
  
  dom.dacGainInput.addEventListener('input', () => {
    if (dacGainNode) {
      dacGainNode.gain.setTargetAtTime(
        parseFloat(dom.dacGainInput.value),
        audioCtx?.currentTime || 0,
        0.01
      );
    }
  });
  
  // Initial setup
  console.log('Running initial setup...');
  addWave({ type: 'sine', amp: 0.6, freq: 440, phaseDeg: 0 });
  renderWaves();
  updateSizeBox();
  console.log('Initial setup complete');
  
  // Add responsive handler
  const handleResize = debounce(() => {
    renderWaves();
  }, 250);
  
  window.addEventListener('resize', handleResize);
  
  // Check for mobile and show hint
  if (isMobile()) {
    console.log('Mobile device detected - UI optimized for touch');
  }
  
  // Export for debugging
  window.audioLabState = state;
  window.audioLabDebug = {
    audioCtx,
    state,
    initAudio,
    addWave,
    renderWaves
  };
  console.log('Audio Lab loaded. Access debug info via window.audioLabDebug');
});
