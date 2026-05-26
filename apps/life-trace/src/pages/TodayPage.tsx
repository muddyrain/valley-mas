import {
  Bell,
  CalendarDays,
  Car,
  Cloud,
  Droplets,
  Heart,
  MapPin,
  Settings,
  Shirt,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchLifeTraceWeather, type WeatherApiResponse } from '@/api/weather';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { hourlyWeather, weatherMetrics } from '@/data/mock';
import { buildWeatherBrief, buildWeatherDrivenAdvice } from '@/lib/weatherAdvice';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Advice } from '@/types';

const adviceToneClasses: Record<Advice['tone'], { bg: string; text: string }> = {
  weather: { bg: 'bg-life-weather/10', text: 'text-life-weather' },
  ai: { bg: 'bg-life-ai/10', text: 'text-life-ai' },
  plan: { bg: 'bg-life-plan/10', text: 'text-life-plan' },
  trace: { bg: 'bg-life-trace/10', text: 'text-life-trace' },
  health: { bg: 'bg-life-health/10', text: 'text-life-health' },
  alert: { bg: 'bg-life-alert/10', text: 'text-life-alert' },
};

const metricIconMap = {
  降水: Droplets,
  湿度: Droplets,
  空气: Wind,
  风力: Wind,
  紫外线: Sun,
  体感: Bell,
};

const metricToneClasses = {
  weather: 'text-life-weather',
  ai: 'text-life-ai',
  trace: 'text-life-trace',
  muted: 'text-muted-foreground',
  health: 'text-life-health',
  alert: 'text-life-alert',
};

const adviceIconMap = {
  wear: Shirt,
  skin: Droplets,
  out: Cloud,
  commute: Car,
  health: Heart,
  plan: CalendarDays,
};

const fallbackWeather: WeatherApiResponse = {
  source: 'mock',
  city: '上海',
  updatedAt: '',
  now: {
    temp: '22',
    feelsLike: '21',
    text: '多云',
    high: '26',
    low: '17',
    humidity: '58%',
    windScale: '3级',
    precip: '20%',
    uvIndex: '中等',
    airQuality: '良',
  },
  metrics: weatherMetrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    tone: metric.label === '风力' ? 'muted' : metric.label === '紫外线' ? 'health' : 'weather',
  })),
  hourly: hourlyWeather.map((hour) => ({
    time: hour.time,
    temp: hour.temp,
    text: hour.time === '现在' ? '多云' : '多云',
    active: hour.active,
  })),
  indices: [],
};

export function TodayPage() {
  const openPlanCount = useLifeTraceStore(
    (state) => state.plans.filter((plan) => !plan.completed).length,
  );
  const settings = useLifeTraceStore((state) => state.settings);
  const setActiveTab = useLifeTraceStore((state) => state.setActiveTab);
  const [weather, setWeather] = useState<WeatherApiResponse>({
    ...fallbackWeather,
    city: settings.city,
  });
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setWeatherLoading(true);

    fetchLifeTraceWeather(settings.city, controller.signal)
      .then(setWeather)
      .catch(() => setWeather({ ...fallbackWeather, city: settings.city }))
      .finally(() => setWeatherLoading(false));

    return () => controller.abort();
  }, [settings.city]);

  const advice = buildWeatherDrivenAdvice({ weather, settings, openPlanCount }).map((item) => ({
    ...item,
    icon: adviceIconMap[item.id as keyof typeof adviceIconMap] ?? Sparkles,
  }));
  const brief = buildWeatherBrief(weather, settings);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Life Trace</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="size-4" />
            <span>{weather.city || settings.city}</span>
            <span>·</span>
            <span>5月26日周二</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={() => setActiveTab('profile')}
        >
          <Settings className="size-5" />
        </button>
      </header>

      <Card className="p-5">
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-16 place-items-center rounded-2xl bg-life-weather/10 text-life-weather">
              <Cloud className="size-9" />
            </div>
            <div>
              <div className="text-6xl font-light leading-none tracking-[-0.04em]">
                {weather.now.temp}°
              </div>
              <div className="mt-2 text-lg text-muted-foreground">{weather.now.text}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-semibold">
              {weather.now.high}° /{' '}
              <span className="text-muted-foreground">{weather.now.low}°</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {weather.city || settings.city}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {weatherLoading ? '更新中' : weather.source === 'qweather' ? 'QWeather' : 'Mock'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {weather.metrics.map((metric) => {
            const Icon = metricIconMap[metric.label as keyof typeof metricIconMap] ?? Cloud;
            const tone = metricToneClasses[metric.tone] ?? 'text-muted-foreground';

            return (
              <div
                key={metric.label}
                className="flex min-w-0 items-center justify-between rounded-2xl bg-secondary px-3 py-3"
              >
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Icon className={`size-5 shrink-0 ${tone}`} />
                  <span className="truncate text-sm">{metric.label}</span>
                </div>
                <span className="text-sm font-semibold">{metric.value}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
          {weather.hourly.map((item) => {
            const Icon = item.text.includes('晴') ? Sun : Cloud;

            return (
              <div
                key={item.time}
                className={`flex min-w-14 flex-col items-center gap-2 rounded-2xl px-3 py-3 ${
                  item.active
                    ? 'bg-life-weather/15 text-life-weather'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                <span className="text-xs font-medium">{item.time}</span>
                <Icon className="size-5" />
                <span className="text-base font-semibold text-foreground">{item.temp}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="flex gap-4 p-5">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
          <Sparkles className="size-6" />
        </div>
        <div className="min-w-0">
          <Badge tone="ai">AI 今日简报</Badge>
          <h2 className="mt-3 text-xl font-semibold">{brief.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{brief.detail}</p>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight">今日建议</h2>
        <div className="grid grid-cols-2 gap-3">
          {advice.map((item) => {
            const Icon = item.icon;
            const tone = adviceToneClasses[item.tone];

            return (
              <Card key={item.id} className="min-h-24 p-4">
                <div className="flex items-center gap-3">
                  <div className={`grid size-10 place-items-center rounded-2xl ${tone.bg}`}>
                    <Icon className={`size-5 ${tone.text}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{item.title}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
