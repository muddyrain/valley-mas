import { describe, expect, it } from 'vitest';
import { buildOutfitSuggestionContext } from '@/lib/outfitSuggestionContext';
import type { Plan, UserSettings } from '@/types';

const baseSettings: UserSettings = {
  city: '上海',
  workStart: '09:00',
  workEnd: '18:00',
  commuteMethod: '地铁',
  dailyBriefTime: '08:30',
  workdayMode: 'legal',
  workdays: ['1', '2', '3', '4', '5'],
  holidaySync: true,
  weekendReminders: true,
  planReminderLeadMinutes: 30,
  quietStart: '22:00',
  quietEnd: '08:00',
  weatherAlerts: true,
  planReminders: true,
  aiPersonalization: true,
  habits: [],
  pantryReminderEnabled: true,
  pantryReminderRules: ['7d', '3d'],
  pantryReminderTime: '09:00',
};

const todayPlan: Plan = {
  id: 'plan-1',
  title: '晚上跑步',
  type: '运动',
  timeLabel: '今天 19:00',
  scheduledDate: '2026-06-15',
  scheduledTime: '19:00',
  reminder: true,
  note: '',
  completed: false,
};

describe('buildOutfitSuggestionContext', () => {
  it('uses cached weather and today plan when available', () => {
    const context = buildOutfitSuggestionContext({
      settings: baseSettings,
      plans: [todayPlan],
      weather: {
        source: 'cache',
        city: '上海',
        updatedAt: '2026-06-15T08:00:00Z',
        now: {
          temp: '28',
          feelsLike: '30',
          text: '晴',
          high: '31°',
          low: '24°',
          humidity: '60%',
          windScale: '2级',
          precip: '10%',
          uvIndex: '强',
          airQuality: '良',
        },
        metrics: [],
        hourly: [],
        daily: [],
        indices: [],
        cached: true,
      },
      todayKey: '2026-06-15',
    });

    expect(context).toMatchObject({
      weatherText: '晴',
      temperature: 28,
      lowTemp: 24,
      highTemp: 31,
      precip: '10%',
      planType: '运动',
      planTitle: '晚上跑步',
      scene: '运动',
    });
  });

  it('falls back to daily context when weather and plans are missing', () => {
    const context = buildOutfitSuggestionContext({
      settings: baseSettings,
      plans: [],
      weather: null,
      todayKey: '2026-06-15',
    });

    expect(context).toEqual({
      weatherText: '今日天气',
      scene: '日常',
    });
  });
});
