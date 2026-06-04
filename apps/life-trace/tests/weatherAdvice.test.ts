import { describe, expect, it } from 'vitest';
import type { WeatherApiResponse } from '../src/api/weather';
import { buildWeatherAlerts } from '../src/lib/weatherAdvice';

const baseWeather: WeatherApiResponse = {
  source: 'qweather',
  city: '上海',
  updatedAt: '2026-05-26T10:00+08:00',
  now: {
    temp: '24',
    feelsLike: '25',
    text: '小雨',
    high: '30',
    low: '18',
    humidity: '82%',
    windScale: '4级',
    precip: '65%',
    uvIndex: '7',
    airQuality: '良',
  },
  metrics: [],
  hourly: [
    { time: '现在', temp: '24°', text: '小雨', active: true },
    { time: '14时', temp: '27°', text: '阵雨' },
  ],
  indices: [],
  cached: false,
};

describe('buildWeatherAlerts', () => {
  it('keeps weather risk alerts available for the home page', () => {
    const alerts = buildWeatherAlerts(baseWeather);

    expect(alerts).toHaveLength(3);
    expect(alerts.map((item) => item.id)).toEqual(['temp-gap', 'rain', 'uv']);
    expect(alerts.find((item) => item.id === 'rain')?.detail).toContain('带伞');
  });
});
