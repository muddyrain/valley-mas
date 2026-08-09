import { clamp } from './ambient-inputs';

export interface AudioBands {
  low: number;
  mid: number;
  high: number;
}

const meanRange = (bins: Uint8Array, start: number, end: number): number => {
  if (end <= start) return 0;
  let total = 0;
  for (let index = start; index < end; index += 1) total += bins[index] ?? 0;
  return clamp(total / (end - start) / 255);
};

export function calculateBandEnergies(bins: Uint8Array, binFrequencyHz: number): AudioBands {
  if (bins.length === 0 || !Number.isFinite(binFrequencyHz) || binFrequencyHz <= 0) {
    return { low: 0, mid: 0, high: 0 };
  }
  const lowEnd = Math.min(bins.length, Math.max(1, Math.ceil(250 / binFrequencyHz)));
  const midEnd = Math.min(bins.length, Math.max(lowEnd + 1, Math.ceil(2000 / binFrequencyHz)));
  return {
    low: meanRange(bins, 0, lowEnd),
    mid: meanRange(bins, lowEnd, midEnd),
    high: meanRange(bins, midEnd, bins.length),
  };
}

export function smoothAudioBands(
  current: AudioBands,
  target: AudioBands,
  smoothing: number,
): AudioBands {
  const attack = clamp(smoothing, 0.01, 1);
  const step = (from: number, to: number): number => {
    const amount = to >= from ? attack : Math.max(0.025, attack * 0.5);
    return clamp(from + (to - from) * amount);
  };
  return {
    low: step(current.low, target.low),
    mid: step(current.mid, target.mid),
    high: step(current.high, target.high),
  };
}
