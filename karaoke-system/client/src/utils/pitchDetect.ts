const NOTE_NAMES = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/** Converts a frequency in Hz to a note name like "A4". */
export function frequencyToNote(freq: number): string {
  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(freq / A4);
  const rounded = Math.round(semitonesFromA4);
  const noteIndex = ((rounded % 12) + 12 + 9) % 12; // +9 shifts so index 0 = C
  const octave = 4 + Math.floor((rounded + 9) / 12);
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export interface PitchDetectionResult {
  frequency: number | null;
  clarity: number; // 0..1, how confident the estimate is
  rms: number; // 0..1 volume level
}

/**
 * Autocorrelation-based pitch detector (ACF2+ style).
 * Operates on a single frame of time-domain audio samples (Float32Array, -1..1).
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  minHz = 70,
  maxHz = 1000
): PitchDetectionResult {
  const size = buffer.length;

  // RMS volume
  let sumSquares = 0;
  for (let i = 0; i < size; i++) sumSquares += buffer[i] * buffer[i];
  const rms = Math.sqrt(sumSquares / size);

  if (rms < 0.01) {
    return { frequency: null, clarity: 0, rms };
  }

  // Trim silence at edges to stabilize autocorrelation
  let start = 0;
  let end = size - 1;
  const threshold = 0.02;
  while (start < size && Math.abs(buffer[start]) < threshold) start++;
  while (end > start && Math.abs(buffer[end]) < threshold) end--;

  const trimmed = buffer.slice(start, end + 1);
  const n = trimmed.length;
  if (n < 512) {
    return { frequency: null, clarity: 0, rms };
  }

  const minLag = Math.floor(sampleRate / maxHz);
  const maxLag = Math.floor(sampleRate / minHz);

  let bestLag = -1;
  let bestCorrelation = 0;
  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag && lag < n; lag++) {
    let sum = 0;
    for (let i = 0; i < n - lag; i++) {
      sum += trimmed[i] * trimmed[i + lag];
    }
    correlations[lag] = sum;
    if (sum > bestCorrelation) {
      bestCorrelation = sum;
      bestLag = lag;
    }
  }

  if (bestLag <= 0) {
    return { frequency: null, clarity: 0, rms };
  }

  // Parabolic interpolation around the peak for sub-sample accuracy
  const y1 = correlations[bestLag - 1] ?? bestCorrelation;
  const y2 = correlations[bestLag];
  const y3 = correlations[bestLag + 1] ?? bestCorrelation;
  const denom = y1 - 2 * y2 + y3;
  const shift = denom !== 0 ? (0.5 * (y1 - y3)) / denom : 0;
  const refinedLag = bestLag + shift;

  const frequency = sampleRate / refinedLag;

  // Normalize correlation strength into a 0..1 clarity score
  let normEnergy = 0;
  for (let i = 0; i < n; i++) normEnergy += trimmed[i] * trimmed[i];
  const clarity = normEnergy > 0 ? Math.min(1, bestCorrelation / normEnergy) : 0;

  if (frequency < minHz || frequency > maxHz) {
    return { frequency: null, clarity: 0, rms };
  }

  return { frequency, clarity, rms };
}
