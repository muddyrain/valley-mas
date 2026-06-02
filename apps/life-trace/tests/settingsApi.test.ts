import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSettings, saveSettings } from '../src/api/settings';
import type { UserSettings } from '../src/types';

const token = 'test-token';

const settings: UserSettings = {
  city: '杭州',
  workStart: '10:00',
  workEnd: '19:00',
  commuteMethod: '地铁',
  dailyBriefTime: '08:40',
  workdayMode: 'legal',
  workdays: ['1', '2', '3', '4', '5'],
  holidaySync: true,
  weekendReminders: false,
  planReminderLeadMinutes: 10,
  quietStart: '23:00',
  quietEnd: '07:00',
  weatherAlerts: false,
  planReminders: true,
  aiPersonalization: false,
  habits: ['喝水', '早睡'],
  pantryReminderEnabled: true,
  pantryReminderRules: ['7d', 'same-day'],
  pantryReminderTime: '09:15',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings api', () => {
  it('loads and saves life-trace settings with bearer token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: settings,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { ...settings, city: '苏州' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const loaded = await getSettings(token);
    const saved = await saveSettings(token, { ...settings, city: '苏州' });

    expect(loaded.city).toBe('杭州');
    expect(saved.city).toBe('苏州');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/settings');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/life-trace/settings');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');

    const headers = fetchMock.mock.calls[1][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });
});
