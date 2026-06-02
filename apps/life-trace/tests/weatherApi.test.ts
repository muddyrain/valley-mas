import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('weather api', () => {
  it('uses the configured API base URL for weather requests', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.muddyrain.top/api/v1');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        source: 'qweather',
        city: '杭州',
        updatedAt: '2026-06-02T17:46+08:00',
        now: {
          temp: '32',
          feelsLike: '34',
          text: '阴',
          high: '35',
          low: '25',
          humidity: '51%',
          windScale: '2级',
          precip: '0%',
          uvIndex: '11',
          airQuality: '良',
        },
        metrics: [],
        hourly: [],
        indices: [],
        cached: false,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { fetchLifeTraceWeather } = await import('../src/api/weather');
    const data = await fetchLifeTraceWeather('杭州', { refresh: true });

    expect(data.city).toBe('杭州');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.muddyrain.top/api/v1/life-trace/weather?city=%E6%9D%AD%E5%B7%9E&refresh=true',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      }),
    );
  });
});
