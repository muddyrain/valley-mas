import {
  Bell,
  CalendarDays,
  Car,
  Check,
  Cloud,
  Droplets,
  Heart,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  Shirt,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fetchLifeTraceWeather, type WeatherApiResponse } from '@/api/weather';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { hourlyWeather, weatherMetrics } from '@/data/mock';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { createPlanFromAdvice, hasAdvicePlan } from '@/lib/advicePlan';
import { gsap, useGSAP } from '@/lib/gsap';
import { buildWeatherBrief, buildWeatherDrivenAdvice } from '@/lib/weatherAdvice';
import { readWeatherCache, writeWeatherCache } from '@/lib/weatherCache';
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
  cached: false,
};

export function TodayPage() {
  const openPlanCount = useLifeTraceStore(
    (state) => state.plans.filter((plan) => !plan.completed).length,
  );
  const plans = useLifeTraceStore((state) => state.plans);
  const settings = useLifeTraceStore((state) => state.settings);
  const setActiveTab = useLifeTraceStore((state) => state.setActiveTab);
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const [weather, setWeather] = useState<WeatherApiResponse>({
    ...fallbackWeather,
    city: settings.city,
  });
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [planToast, setPlanToast] = useState('');
  const pageRef = useRef<HTMLDivElement>(null);
  const advice = buildWeatherDrivenAdvice({ weather, settings, openPlanCount }).map((item) => ({
    ...item,
    icon: adviceIconMap[item.id as keyof typeof adviceIconMap] ?? Sparkles,
  }));
  const brief = buildWeatherBrief(weather, settings);

  useLifeTraceEntrance(pageRef, {
    selector: '[data-today-entrance], [data-today-stagger]',
    y: 20,
    scale: 0.985,
    stagger: 0.06,
    delay: 0.03,
    duration: 0.62,
    ease: 'power3.out',
  });

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({ delay: 0.42 });

        timeline
          .from('[data-ai-brief-card]', {
            boxShadow: '0 0 0 rgba(6,182,212,0)',
            duration: 0.42,
            ease: 'power2.out',
          })
          .from(
            '[data-ai-brief-orb]',
            {
              autoAlpha: 0,
              scale: 0.72,
              rotation: -12,
              duration: 0.58,
              ease: 'back.out(1.8)',
              clearProps: 'transform,opacity,visibility',
            },
            '<',
          )
          .from(
            '[data-ai-brief-copy]',
            {
              autoAlpha: 0,
              y: 10,
              duration: 0.48,
              stagger: 0.055,
              ease: 'power2.out',
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.24',
          )
          .to(
            '[data-ai-brief-orb]',
            {
              y: -3,
              scale: 1.04,
              duration: 0.72,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: 1,
              clearProps: 'transform',
            },
            '-=0.18',
          );
      });

      return () => mm.revert();
    },
    { scope: pageRef, dependencies: [brief.title, brief.detail], revertOnUpdate: true },
  );

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const timeline = gsap.timeline({ delay: 0.56 });

        timeline
          .from('[data-advice-card]', {
            autoAlpha: 0,
            y: 18,
            scale: 0.97,
            duration: 0.52,
            stagger: 0.07,
            ease: 'power3.out',
            clearProps: 'transform,opacity,visibility',
          })
          .from(
            '[data-advice-icon]',
            {
              autoAlpha: 0,
              scale: 0.72,
              rotation: -8,
              duration: 0.34,
              stagger: 0.055,
              ease: 'back.out(1.9)',
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.36',
          )
          .from(
            '[data-advice-action]',
            {
              autoAlpha: 0,
              scale: 0.72,
              y: -4,
              duration: 0.32,
              stagger: 0.045,
              ease: 'back.out(2)',
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.3',
          );
      });

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set('[data-advice-card], [data-advice-icon], [data-advice-action]', {
          clearProps: 'all',
        });
      });

      return () => mm.revert();
    },
    { scope: pageRef, dependencies: [advice.length], revertOnUpdate: true },
  );

  useEffect(() => {
    const controller = new AbortController();
    const cached = readWeatherCache(window.localStorage, settings.city);
    if (cached) {
      setWeather(cached);
      return () => controller.abort();
    }

    setWeatherLoading(true);

    fetchLifeTraceWeather(settings.city, { signal: controller.signal })
      .then((resp) => {
        setWeather(resp);
        writeWeatherCache(window.localStorage, settings.city, resp);
      })
      .catch(() => setWeather({ ...fallbackWeather, city: settings.city }))
      .finally(() => setWeatherLoading(false));

    return () => controller.abort();
  }, [settings.city]);

  const handleAddAdvicePlan = async (item: Advice) => {
    if (hasAdvicePlan(plans, item.id)) {
      setPlanToast('这个建议已经在今日计划里');
      return;
    }

    const plan = await addPlan(
      createPlanFromAdvice({
        id: item.id,
        title: item.title,
        detail: item.detail,
        city: weather.city || settings.city,
      }),
    );
    setPlanToast(plan ? '已加入今日计划' : '计划保存失败，稍后再试');
  };
  const handleRefreshWeather = () => {
    if (weatherLoading) {
      return;
    }

    setWeatherLoading(true);
    fetchLifeTraceWeather(settings.city, { refresh: true })
      .then((resp) => {
        setWeather(resp);
        writeWeatherCache(window.localStorage, settings.city, resp);
        setPlanToast(resp.refreshLimited ? '刚刚刷新过，已使用缓存天气' : '天气已刷新');
      })
      .catch(() => setPlanToast('天气刷新失败，稍后再试'))
      .finally(() => setWeatherLoading(false));
  };

  useEffect(() => {
    if (!planToast) {
      return;
    }

    const timer = window.setTimeout(() => setPlanToast(''), 1800);
    return () => window.clearTimeout(timer);
  }, [planToast]);

  return (
    <div ref={pageRef} className="space-y-5">
      <header className="flex items-start justify-between" data-today-entrance>
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

      <Card className="p-5" data-today-entrance>
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-4" data-today-stagger>
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
          <div className="text-right" data-today-stagger>
            <div className="text-xl font-semibold">
              {weather.now.high}° /{' '}
              <span className="text-muted-foreground">{weather.now.low}°</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {weather.city || settings.city}
            </div>
            <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted-foreground">
              <span>
                {weatherLoading
                  ? '更新中'
                  : weather.source === 'qweather'
                    ? weather.cached
                      ? 'QWeather · 缓存'
                      : 'QWeather'
                    : 'Mock'}
              </span>
              <button
                type="button"
                className="grid size-7 cursor-pointer place-items-center rounded-full bg-secondary text-muted-foreground transition hover:text-foreground disabled:cursor-default disabled:opacity-60"
                aria-label="刷新天气"
                disabled={weatherLoading}
                onClick={handleRefreshWeather}
              >
                <RefreshCw className={`size-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
              </button>
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
                data-today-stagger
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

        <div className="mt-5 flex gap-3 overflow-x-auto pb-1" data-today-stagger>
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

      <Card
        className="relative overflow-hidden border-life-ai/20 p-5 shadow-[0_18px_70px_rgba(6,182,212,0.08)]"
        data-ai-brief-card
        data-today-entrance
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/70 to-transparent"
        />
        <div className="relative flex gap-4">
          <div
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai"
            data-ai-brief-orb
          >
            <Sparkles className="size-6" />
          </div>
          <div className="min-w-0">
            <div data-ai-brief-copy>
              <Badge tone="ai">AI 今日简报</Badge>
            </div>
            <h2 className="mt-3 text-xl font-semibold" data-ai-brief-copy>
              {brief.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground" data-ai-brief-copy>
              {brief.detail}
            </p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-xl font-semibold tracking-tight" data-today-entrance>
          今日建议
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {advice.map((item) => {
            const Icon = item.icon;
            const tone = adviceToneClasses[item.tone];
            const isAdded = hasAdvicePlan(plans, item.id);

            return (
              <Card
                key={item.id}
                className="group relative h-28 overflow-hidden border-border/80 p-4 transition-colors hover:border-foreground/20"
                data-advice-card
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent opacity-70"
                />
                <button
                  type="button"
                  disabled={isAdded}
                  className="absolute top-3 right-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-secondary text-foreground transition duration-200 hover:scale-105 hover:bg-accent active:scale-95 disabled:cursor-default disabled:text-life-trace disabled:opacity-100 disabled:hover:scale-100"
                  aria-label={isAdded ? '已添加计划' : `添加${item.title}计划`}
                  onClick={() => void handleAddAdvicePlan(item)}
                  data-advice-action
                >
                  {isAdded ? <Check className="size-4" /> : <Plus className="size-4" />}
                </button>
                <div className="flex items-center gap-2 pr-10">
                  <div
                    className={`grid size-8 shrink-0 place-items-center rounded-xl ${tone.bg}`}
                    data-advice-icon
                  >
                    <Icon className={`size-4.5 ${tone.text}`} />
                  </div>
                  <h3 className="min-w-0 truncate text-base font-semibold">{item.title}</h3>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">
                  {item.detail}
                </p>
              </Card>
            );
          })}
        </div>
      </section>
      {planToast ? (
        <div className="fixed right-6 bottom-28 left-6 z-30 mx-auto max-w-[360px] rounded-2xl border border-life-trace/30 bg-card px-4 py-3 text-center text-sm font-medium text-life-trace shadow-2xl">
          {planToast}
        </div>
      ) : null}
    </div>
  );
}
