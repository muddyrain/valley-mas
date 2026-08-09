import { describe, expect, it } from 'vitest';
import { calculateBandEnergies, smoothAudioBands } from './audio-analysis';

describe('audio analysis', () => {
  it('分别计算低中高三个频段并归一化', () => {
    const bins = new Uint8Array(32);
    bins.fill(255, 0, 2);
    bins.fill(128, 2, 16);
    bins.fill(64, 16);

    const bands = calculateBandEnergies(bins, 125);
    expect(bands.low).toBeCloseTo(1, 2);
    expect(bands.mid).toBeCloseTo(128 / 255, 2);
    expect(bands.high).toBeCloseTo(64 / 255, 2);
  });

  it('使用平滑并在无输入时逐渐回落而非骤降', () => {
    const active = smoothAudioBands({ low: 0, mid: 0, high: 0 }, { low: 1, mid: 1, high: 1 }, 0.2);
    const falling = smoothAudioBands(active, { low: 0, mid: 0, high: 0 }, 0.2);

    expect(active.low).toBeCloseTo(0.2);
    expect(falling.low).toBeGreaterThan(0);
    expect(falling.low).toBeLessThan(active.low);
  });
});
