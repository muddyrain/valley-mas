import { describe, expect, it } from 'vitest';
import { ENVIRONMENT_PRESETS, getEnvironmentPresetChanges } from './environment-presets';

describe('environment presets', () => {
  it('提供细雨、雷暴、暴雪、晨雾和金色黄昏五种完整组合', () => {
    expect(Object.keys(ENVIRONMENT_PRESETS)).toEqual([
      'drizzle',
      'thunderstorm',
      'blizzard',
      'morning-mist',
      'golden-hour',
    ]);
    expect(getEnvironmentPresetChanges('thunderstorm')).toMatchObject({
      weather: 'rain',
      weatherIntensity: 1,
      wind: 0.92,
      followRealTime: false,
    });
    expect(getEnvironmentPresetChanges('golden-hour')).toMatchObject({
      weather: 'clear',
      manualTime: 17.6,
    });
  });
});
