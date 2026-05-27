import { describe, expect, it } from 'vitest';
import type { WeatherApiResponse } from '../src/api/weather';
import { readWeatherCache, writeWeatherCache } from '../src/lib/weatherCache';

const weather: WeatherApiResponse = {
  source: 'qweather',
  city: '杭州',
  updatedAt: '2026-05-26T22:00+08:00',
  now: {
    temp: '25',
    feelsLike: '26',
    text: '多云',
    high: '31',
    low: '24',
    humidity: '88%',
    windScale: '3级',
    precip: '0%',
    uvIndex: '4',
    airQuality: '良',
  },
  metrics: [],
  hourly: [],
  indices: [],
  cached: false,
};

function createMemoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

describe('weatherCache', () => {
  it('reads fresh cache by city', () => {
    const storage = createMemoryStorage();
    writeWeatherCache(storage, '杭州', weather, 1_000);

    const cached = readWeatherCache(storage, '杭州', 1_500, 60_000);

    expect(cached?.city).toBe('杭州');
    expect(cached?.cached).toBe(true);
  });

  it('ignores expired cache', () => {
    const storage = createMemoryStorage();
    writeWeatherCache(storage, '杭州', weather, 1_000);

    const cached = readWeatherCache(storage, '杭州', 100_000, 60_000);

    expect(cached).toBeNull();
  });
});
