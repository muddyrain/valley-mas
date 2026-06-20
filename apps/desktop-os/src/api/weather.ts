import { getApiBaseUrl } from './client';

export const DEFAULT_WEATHER_CITY = '上海';

export interface WeatherApiMetric {
  label: string;
  value: string;
  tone: 'weather' | 'ai' | 'trace' | 'muted' | 'health' | 'alert';
}

export interface WeatherApiHour {
  time: string;
  dateTime?: string;
  temp: string;
  text: string;
  active?: boolean;
}

export interface WeatherApiDay {
  date: string;
  high: string;
  low: string;
  textDay: string;
}

export interface WeatherApiIndex {
  name: string;
  category: string;
  text: string;
}

export interface WeatherApiResponse {
  source: 'qweather' | 'mock';
  city: string;
  updatedAt: string;
  now: {
    temp: string;
    feelsLike: string;
    text: string;
    high: string;
    low: string;
    humidity: string;
    windScale: string;
    precip: string;
    uvIndex: string;
    airQuality: string;
  };
  metrics: WeatherApiMetric[];
  hourly: WeatherApiHour[];
  daily: WeatherApiDay[];
  indices: WeatherApiIndex[];
  cached: boolean;
  refreshLimited?: boolean;
  refreshAllowedAt?: string;
  warning?: string;
}

interface FetchDesktopWeatherOptions {
  refresh?: boolean;
  signal?: AbortSignal;
}

export async function fetchDesktopWeather(
  city = DEFAULT_WEATHER_CITY,
  options: FetchDesktopWeatherOptions = {},
) {
  const params = new URLSearchParams({ city });
  if (options.refresh) params.set('refresh', 'true');

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}/life-trace/weather?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });
  } catch {
    throw new Error('天气加载失败');
  }

  if (!response.ok) {
    throw new Error('天气加载失败');
  }

  return (await response.json()) as WeatherApiResponse;
}
