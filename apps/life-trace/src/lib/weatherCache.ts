import type { WeatherApiResponse } from '@/api/weather';

export const WEATHER_CLIENT_CACHE_MS = 10 * 60 * 1000;

type WeatherCacheEntry = {
  city: string;
  savedAt: number;
  data: WeatherApiResponse;
};

type WeatherStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function readWeatherCache(
  storage: WeatherStorage,
  city: string,
  now = Date.now(),
  maxAgeMs = WEATHER_CLIENT_CACHE_MS,
) {
  const key = weatherCacheKey(city);
  const raw = storage.getItem(key);
  if (!raw) {
    return null;
  }

  try {
    const entry = JSON.parse(raw) as WeatherCacheEntry;
    if (entry.city !== normalizeCity(city) || now - entry.savedAt > maxAgeMs) {
      return null;
    }
    return { ...entry.data, cached: true };
  } catch {
    storage.removeItem(key);
    return null;
  }
}

export function writeWeatherCache(
  storage: WeatherStorage,
  city: string,
  data: WeatherApiResponse,
  now = Date.now(),
) {
  const entry: WeatherCacheEntry = {
    city: normalizeCity(city),
    savedAt: now,
    data: { ...data, cached: false, refreshLimited: false },
  };
  storage.setItem(weatherCacheKey(city), JSON.stringify(entry));
}

function weatherCacheKey(city: string) {
  return `life-trace-weather:${normalizeCity(city)}`;
}

function normalizeCity(city: string) {
  return city.trim().toLowerCase();
}
