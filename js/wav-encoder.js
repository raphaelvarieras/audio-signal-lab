// WAV file encoding utilities

import { clamp } from './utils.js';

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function encodeWavFromPCM(floatData, sampleRate, bits, channels = 1) {
  // Interleave channels if stereo
  const N = floatData.length;
  const ch = channels;
  const interleaved = new Float32Array(N * ch);
  
  if (ch === 1) {
    interleaved.set(floatData);
  } else {
    // Duplicate mono to stereo
    for (let i = 0; i < N; i++) {
      const v = floatData[i];
      interleaved[2 * i] = v;
      interleaved[2 * i + 1] = v;
    }
  }

  // Create buffer with WAV header
  const bytesPerSample = (bits === 24) ? 3 : (bits === 16 ? 2 : 1);
  const blockAlign = ch * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = interleaved.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM fmt chunk length
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, ch, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bits, true);
  
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write samples
  let offset = 44;
  if (bits === 16) {
    for (let i = 0; i < interleaved.length; i++) {
      const s = clamp(interleaved[i], -1, 1);
      view.setInt16(offset, Math.round(s * 32767), true);
      offset += 2;
    }
  } else if (bits === 24) {
    for (let i = 0; i < interleaved.length; i++) {
      const s = clamp(interleaved[i], -1, 1);
      const v = Math.round(s * 8388607); // 2^23 - 1
      view.setUint8(offset + 0, (v & 0xFF));        // little-endian 24-bit
      view.setUint8(offset + 1, (v >> 8) & 0xFF);
      view.setUint8(offset + 2, (v >> 16) & 0xFF);
      offset += 3;
    }
  } else { // 8-bit unsigned PCM
    for (let i = 0; i < interleaved.length; i++) {
      const s = clamp(interleaved[i], -1, 1);
      const v = Math.round((s * 0.5 + 0.5) * 255);
      view.setUint8(offset, v);
      offset += 1;
    }
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

export function encodeWavFromULaw(ulawBytes, sampleRate, channels = 1) {
  // μ-law is stored as 8-bit with format code 7 (G.711 μ-law)
  const N = ulawBytes.length;
  const ch = channels;
  const interleaved = (ch === 1) ? ulawBytes : (() => {
    const out = new Uint8Array(N * 2);
    for (let i = 0; i < N; i++) {
      const v = ulawBytes[i];
      out[2 * i] = v;
      out[2 * i + 1] = v;
    }
    return out;
  })();

  const bytesPerSample = 1;
  const blockAlign = ch * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = interleaved.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  
  // fmt chunk (note: μ-law uses format code 7)
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 18, true);    // fmt chunk size for non-PCM
  view.setUint16(20, 7, true);     // format code 7 = μ-law
  view.setUint16(22, ch, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8, true);     // bits per sample (8)
  view.setUint16(36, 0, true);     // cbSize (extra size) = 0
  
  // data chunk
  writeString(view, 38, 'data');
  view.setUint32(42, dataSize, true);

  // Write μ-law data
  let off = 44;
  for (let i = 0; i < interleaved.length; i++) {
    view.setUint8(off + i, interleaved[i]);
  }
  
  return new Blob([buffer], { type: 'audio/wav' });
}

