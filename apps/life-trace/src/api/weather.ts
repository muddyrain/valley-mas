export type WeatherApiMetric = {
  label: string;
  value: string;
  tone: 'weather' | 'ai' | 'trace' | 'muted' | 'health' | 'alert';
};

export type WeatherApiHour = {
  time: string;
  temp: string;
  text: string;
  active?: boolean;
};

export type WeatherApiIndex = {
  name: string;
  category: string;
  text: string;
};

export type WeatherApiResponse = {
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
  indices: WeatherApiIndex[];
  warning?: string;
};

export async function fetchLifeTraceWeather(city: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ city });
  const response = await fetch(`/api/v1/life-trace/weather?${params.toString()}`, {
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`天气接口返回异常：${response.status}`);
  }

  return (await response.json()) as WeatherApiResponse;
}
