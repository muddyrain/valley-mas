import { describe, expect, it } from 'vitest';
import type { WeatherApiResponse } from '../src/api/weather';
import { buildWeatherDrivenAdvice } from '../src/lib/weatherAdvice';
import type { UserSettings } from '../src/types';

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
};

const settings: UserSettings = {
  city: '上海',
  workStart: '09:30',
  workEnd: '18:30',
  commuteMethod: '开车',
  dailyBriefTime: '08:10',
  weatherAlerts: true,
  planReminders: true,
  aiPersonalization: true,
  habits: ['喝水', '休息', '运动'],
};

describe('buildWeatherDrivenAdvice', () => {
  it('generates rain, temperature gap, skincare and commute advice from real weather', () => {
    const advice = buildWeatherDrivenAdvice({
      weather: baseWeather,
      settings,
      openPlanCount: 2,
    });

    expect(advice).toHaveLength(6);
    expect(advice.find((item) => item.id === 'wear')?.detail).toContain('分层');
    expect(advice.find((item) => item.id === 'skin')?.detail).toContain('防晒');
    expect(advice.find((item) => item.id === 'out')?.detail).toContain('带伞');
    expect(advice.find((item) => item.id === 'commute')?.detail).toContain('开车');
    expect(advice.find((item) => item.id === 'commute')?.detail).toContain('提前');
    expect(advice.find((item) => item.id === 'plan')?.detail).toContain('2个');
  });
});
