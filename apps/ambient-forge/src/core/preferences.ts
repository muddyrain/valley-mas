import { clamp, type WeatherMode } from './ambient-inputs';
import type { QualityLevel } from './quality';

export interface AmbientPreferences {
  followRealTime: boolean;
  manualTime: number;
  weather: WeatherMode;
  weatherIntensity: number;
  wind: number;
  musicVolume: number;
  musicResponse: number;
  environmentEnabled: boolean;
  environmentVolume: number;
  quality: QualityLevel;
  panelOpen: boolean;
}

export const PREFERENCES_STORAGE_KEY = 'ambient-forge:preferences';
export const PREFERENCES_VERSION = 1;

export const DEFAULT_PREFERENCES: AmbientPreferences = {
  followRealTime: true,
  manualTime: 12,
  weather: 'clear',
  weatherIntensity: 0.55,
  wind: 0.32,
  musicVolume: 0.75,
  musicResponse: 0.72,
  environmentEnabled: false,
  environmentVolume: 0.28,
  quality: 'medium',
  panelOpen: true,
};

const weatherModes: readonly WeatherMode[] = ['clear', 'rain', 'snow', 'fog'];
const qualityLevels: readonly QualityLevel[] = ['low', 'medium', 'high'];

function isPreferences(value: unknown): value is AmbientPreferences {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.followRealTime === 'boolean' &&
    typeof item.manualTime === 'number' &&
    item.manualTime >= 0 &&
    item.manualTime <= 24 &&
    weatherModes.includes(item.weather as WeatherMode) &&
    typeof item.weatherIntensity === 'number' &&
    item.weatherIntensity >= 0 &&
    item.weatherIntensity <= 1 &&
    typeof item.wind === 'number' &&
    item.wind >= 0 &&
    item.wind <= 1 &&
    typeof item.musicResponse === 'number' &&
    item.musicResponse >= 0 &&
    item.musicResponse <= 1 &&
    typeof item.musicVolume === 'number' &&
    item.musicVolume >= 0 &&
    item.musicVolume <= 1 &&
    typeof item.environmentEnabled === 'boolean' &&
    typeof item.environmentVolume === 'number' &&
    item.environmentVolume >= 0 &&
    item.environmentVolume <= 1 &&
    qualityLevels.includes(item.quality as QualityLevel) &&
    typeof item.panelOpen === 'boolean'
  );
}

export function serializePreferences(preferences: AmbientPreferences): string {
  return JSON.stringify({ version: PREFERENCES_VERSION, settings: preferences });
}

export function parsePreferences(raw: string | null): AmbientPreferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const payload = JSON.parse(raw) as { version?: unknown; settings?: unknown };
    if (payload.version !== PREFERENCES_VERSION || !isPreferences(payload.settings)) {
      return DEFAULT_PREFERENCES;
    }
    return {
      ...payload.settings,
      manualTime: clamp(payload.settings.manualTime, 0, 24),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}
