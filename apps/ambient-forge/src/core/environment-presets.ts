import type { AmbientPreferences } from './preferences';

export type EnvironmentPresetId =
  | 'drizzle'
  | 'thunderstorm'
  | 'blizzard'
  | 'morning-mist'
  | 'golden-hour';

export interface EnvironmentPreset {
  label: string;
  changes: Pick<
    AmbientPreferences,
    'followRealTime' | 'manualTime' | 'weather' | 'weatherIntensity' | 'wind'
  >;
}

export const ENVIRONMENT_PRESETS: Readonly<Record<EnvironmentPresetId, EnvironmentPreset>> =
  Object.freeze({
    drizzle: {
      label: '细雨',
      changes: {
        followRealTime: false,
        manualTime: 14.4,
        weather: 'rain',
        weatherIntensity: 0.42,
        wind: 0.24,
      },
    },
    thunderstorm: {
      label: '雷暴',
      changes: {
        followRealTime: false,
        manualTime: 14.2,
        weather: 'rain',
        weatherIntensity: 1,
        wind: 0.92,
      },
    },
    blizzard: {
      label: '暴雪',
      changes: {
        followRealTime: false,
        manualTime: 8.2,
        weather: 'snow',
        weatherIntensity: 1,
        wind: 0.78,
      },
    },
    'morning-mist': {
      label: '晨雾',
      changes: {
        followRealTime: false,
        manualTime: 6.35,
        weather: 'fog',
        weatherIntensity: 0.72,
        wind: 0.08,
      },
    },
    'golden-hour': {
      label: '金色黄昏',
      changes: {
        followRealTime: false,
        manualTime: 17.6,
        weather: 'clear',
        weatherIntensity: 0.28,
        wind: 0.18,
      },
    },
  });

export function getEnvironmentPresetChanges(id: EnvironmentPresetId): EnvironmentPreset['changes'] {
  return { ...ENVIRONMENT_PRESETS[id].changes };
}
