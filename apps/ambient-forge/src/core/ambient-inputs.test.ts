import { describe, expect, it } from 'vitest';
import { clampAmbientInputs } from './ambient-inputs';

describe('clampAmbientInputs', () => {
  it('将时间与所有连续输入限制在标准范围内', () => {
    expect(
      clampAmbientInputs({
        timeOfDay: 27,
        weather: 'rain',
        weatherIntensity: -0.2,
        wind: 1.4,
        audioLow: 2,
        audioMid: -1,
        audioHigh: 0.45,
        pointerX: -3,
        pointerY: 4,
        reducedMotion: false,
      }),
    ).toEqual({
      timeOfDay: 24,
      weather: 'rain',
      weatherIntensity: 0,
      wind: 1,
      audioLow: 1,
      audioMid: 0,
      audioHigh: 0.45,
      pointerX: -1,
      pointerY: 1,
      reducedMotion: false,
    });
  });
});
