import {
  AlertTriangle,
  Bell,
  CalendarDays,
  Car,
  Check,
  Cloud,
  Droplets,
  Heart,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Settings,
  Shirt,
  Sparkles,
  Sun,
  Wind,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateTodayAdvice } from '@/api/advice';
import { fetchLifeTraceWeather, type WeatherApiResponse } from '@/api/weather';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { hourlyWeather, weatherMetrics } from '@/data/mock';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { createPlanFromAdvice, hasAdvicePlan } from '@/lib/advicePlan';
import { gsap, useGSAP } from '@/lib/gsap';
import { getNextReminder } from '@/lib/planReminder';
import { getLocalISODate } from '@/lib/planSchedule';
import {
  buildWeatherAlerts,
  buildWeatherBrief,
  buildWeatherDrivenAdvice,
} from '@/lib/weatherAdvice';
import { readWeatherCache, writeWeatherCache } from '@/lib/weatherCache';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Advice, AdvicePayload } from '@/types';

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

const AI_ADVICE_CACHE_KEY = 'life-trace-ai-advice-cache';

type CachedAdvice = {
  contextVersion: string;
  summary?: string;
  list: AdvicePayload[];
  cachedAt: number;
};

function readCachedAdvice(contextVersion?: string) {
  try {
    const raw = window.localStorage.getItem(AI_ADVICE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as CachedAdvice;
    if (!Array.isArray(cached.list)) {
      return null;
    }
    if (contextVersion && cached.contextVersion !== contextVersion) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCachedAdvice(cached: CachedAdvice) {
  try {
    window.localStorage.setItem(AI_ADVICE_CACHE_KEY, JSON.stringify(cached));
  } catch {
    // Stored advice should never block the page.
  }
}

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
  const plansLoaded = useLifeTraceStore((state) => state.plansLoaded);
  const planCreating = useLifeTraceStore((state) => state.planCreating);
  const checkins = useLifeTraceStore((state) => state.checkins);
  const checkinsDate = useLifeTraceStore((state) => state.checkinsDate);
  const checkinsLoading = useLifeTraceStore((state) => state.checkinsLoading);
  const checkinsError = useLifeTraceStore((state) => state.checkinsError);
  const checkinTogglingByName = useLifeTraceStore((state) => state.checkinTogglingByName);
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const loadCheckins = useLifeTraceStore((state) => state.loadCheckins);
  const toggleHabitCheckin = useLifeTraceStore((state) => state.toggleHabitCheckin);
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherApiResponse>({
    ...fallbackWeather,
    city: settings.city,
  });
  const [weatherReady, setWeatherReady] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [remoteAdvice, setRemoteAdvice] = useState<AdvicePayload[] | null>(null);
  const [remoteAdviceSummary, setRemoteAdviceSummary] = useState('');
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [adviceRefreshing, setAdviceRefreshing] = useState(false);
  const [planToast, setPlanToast] = useState('');
  const [addingAdviceId, setAddingAdviceId] = useState<string | null>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const planFingerprint = useMemo(
    () => plans.map((plan) => `${plan.id}:${plan.completed}:${plan.updatedAt ?? ''}`).join('|'),
    [plans],
  );
  const todayDate = useMemo(() => getLocalISODate(new Date()), []);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
      }).format(new Date()),
    [],
  );
  const habitNames =
    settings.habits.length > 0 ? settings.habits : ['喝水', '休息', '运动', '护肤'];
  const todayCheckins = checkinsDate === todayDate ? checkins : [];
  const checkinFingerprint = useMemo(
    () =>
      todayCheckins
        .map((item) => `${item.name}:${item.completed}:${item.updatedAt ?? ''}`)
        .sort()
        .join('|'),
    [todayCheckins],
  );
  const adviceContextVersion = [
    settings.city,
    settings.workStart,
    settings.workEnd,
    settings.commuteMethod,
    settings.habits.join('、'),
    openPlanCount,
    planFingerprint,
    checkinFingerprint,
  ].join('|');
  const localAdvice =
    settings.aiPersonalization || !weatherReady
      ? []
      : buildWeatherDrivenAdvice({ weather, settings, openPlanCount });
  const advice = (remoteAdvice ?? localAdvice).map((item) => ({
    ...item,
    icon: adviceIconMap[item.id as keyof typeof adviceIconMap] ?? Sparkles,
  }));
  const showWeatherSkeleton = !weatherReady;
  const showAdviceSkeleton =
    (!weatherReady && !remoteAdvice) ||
    (settings.aiPersonalization && adviceLoading && !remoteAdvice);
  const showAdviceEmpty = settings.aiPersonalization && !adviceLoading && !remoteAdvice;
  const localBrief = buildWeatherBrief(weather, settings);
  const weatherAlerts = useMemo(() => buildWeatherAlerts(weather), [weather]);
  const weatherNotice = weatherError || weather.warning || '';
  const shouldWaitForAiBrief = Boolean(token) && (!settingsLoaded || settings.aiPersonalization);
  const showBriefSkeleton = !remoteAdviceSummary && (!weatherReady || shouldWaitForAiBrief);
  const aiBriefTitle = remoteAdviceSummary ? 'AI 已读今日状态' : localBrief.title;
  const aiBriefDetail = remoteAdviceSummary || localBrief.detail;
  const nextReminder = getNextReminder(plans);
  const completedHabitCount = habitNames.filter((name) =>
    todayCheckins.some((item) => item.name === name && item.completed),
  ).length;
  const habitProgress = `${completedHabitCount}/${habitNames.length}`;
  const checkinAdviceText = adviceLoading
    ? '正在结合今日打卡刷新建议。'
    : completedHabitCount > 0
      ? `已完成 ${completedHabitCount} 项，AI 建议会优先避开重复提醒。`
      : '先完成一个小打卡，AI 建议会更贴近今天的真实状态。';
  const adviceStatusText = remoteAdvice
    ? adviceRefreshing
      ? 'AI 刷新中'
      : 'AI 建议'
    : adviceLoading
      ? '生成中'
      : settings.aiPersonalization
        ? '等待 AI'
        : '基础建议';

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
    {
      scope: pageRef,
      dependencies: [],
    },
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
      setWeatherReady(true);
      setWeatherLoading(false);
      setWeatherError(cached.warning ?? '');
      return () => controller.abort();
    }

    setWeatherReady(false);
    setWeatherLoading(true);
    setWeatherError('');

    fetchLifeTraceWeather(settings.city, { signal: controller.signal })
      .then((resp) => {
        if (controller.signal.aborted) {
          return;
        }
        setWeather(resp);
        setWeatherError(resp.warning ?? '');
        writeWeatherCache(window.localStorage, settings.city, resp);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWeather({ ...fallbackWeather, city: settings.city });
          setWeatherError('天气加载失败，已显示本地参考天气');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setWeatherReady(true);
          setWeatherLoading(false);
        }
      });

    return () => controller.abort();
  }, [settings.city]);

  useEffect(() => {
    if (!token || !settings.aiPersonalization || !settingsLoaded || !plansLoaded) {
      setRemoteAdvice(null);
      setRemoteAdviceSummary('');
      setAdviceLoading(false);
      setAdviceRefreshing(false);
      return;
    }

    const controller = new AbortController();
    const cached = readCachedAdvice(adviceContextVersion);
    if (cached) {
      setRemoteAdvice(cached.list);
      setRemoteAdviceSummary(cached.summary ?? '');
    } else {
      setRemoteAdvice(null);
      setRemoteAdviceSummary('');
    }
    setAdviceLoading(!cached);
    setAdviceRefreshing(Boolean(cached));

    const timer = window.setTimeout(() => {
      if (!cached) {
        setAdviceLoading(true);
      } else {
        setAdviceRefreshing(true);
      }

      generateTodayAdvice(token, { signal: controller.signal })
        .then((resp) => {
          if (controller.signal.aborted) {
            return;
          }
          setRemoteAdvice(resp.list);
          setRemoteAdviceSummary(resp.summary);
          writeCachedAdvice({
            contextVersion: adviceContextVersion,
            summary: resp.summary,
            list: resp.list,
            cachedAt: Date.now(),
          });
        })
        .catch(() => {
          if (!cached) {
            setRemoteAdvice(null);
            setRemoteAdviceSummary('');
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setAdviceLoading(false);
            setAdviceRefreshing(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [token, settings.aiPersonalization, settingsLoaded, plansLoaded, adviceContextVersion]);

  useEffect(() => {
    if (!token || !settingsLoaded) {
      return;
    }

    void loadCheckins(todayDate);
  }, [loadCheckins, settingsLoaded, todayDate, token]);

  const handleAddAdvicePlan = async (item: Advice) => {
    if (hasAdvicePlan(plans, item.id)) {
      setPlanToast('这个建议已经在今日计划里');
      return;
    }

    setAddingAdviceId(item.id);
    try {
      const plan = await addPlan(
        createPlanFromAdvice({
          id: item.id,
          title: item.title,
          detail: item.detail,
          city: weather.city || settings.city,
        }),
      );
      setPlanToast(plan ? '已加入今日计划' : '计划保存失败，稍后再试');
    } finally {
      setAddingAdviceId(null);
    }
  };
  const handleRefreshWeather = () => {
    if (weatherLoading) {
      return;
    }

    setWeatherLoading(true);
    setWeatherError('');
    fetchLifeTraceWeather(settings.city, { refresh: true })
      .then((resp) => {
        setWeather(resp);
        setWeatherReady(true);
        setWeatherError(resp.warning ?? '');
        writeWeatherCache(window.localStorage, settings.city, resp);
        setPlanToast(resp.refreshLimited ? '刚刚刷新过，已使用缓存天气' : '天气已刷新');
      })
      .catch(() => {
        setWeatherError('天气刷新失败，已保留当前天气');
        setPlanToast('天气刷新失败，稍后再试');
      })
      .finally(() => setWeatherLoading(false));
  };

  const handleToggleCheckin = (name: string) => {
    const current = todayCheckins.find((item) => item.name === name);
    void toggleHabitCheckin(todayDate, name, !current?.completed);
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
            <span>{weatherReady ? weather.city || settings.city : settings.city}</span>
            <span>·</span>
            <span>{todayLabel}</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={() => navigate('/profile')}
        >
          <Settings className="size-5" />
        </button>
      </header>

      <Card className="p-5" data-today-entrance>
        {showWeatherSkeleton ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="size-16 animate-pulse rounded-2xl bg-life-weather/10" />
                <div>
                  <div className="h-14 w-24 animate-pulse rounded-2xl bg-secondary" />
                  <div className="mt-3 h-5 w-16 animate-pulse rounded-full bg-secondary" />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <div className="h-6 w-20 animate-pulse rounded-full bg-secondary" />
                <div className="mt-3 h-4 w-14 animate-pulse rounded-full bg-secondary" />
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-3 w-12 animate-pulse rounded-full bg-secondary" />
                  <div className="size-7 animate-pulse rounded-full bg-secondary" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`weather-metric-skeleton-${index}`}
                  className="flex items-center justify-between rounded-2xl bg-secondary px-3 py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="size-5 animate-pulse rounded-full bg-muted" />
                    <div className="h-4 w-12 animate-pulse rounded-full bg-muted" />
                  </div>
                  <div className="h-4 w-10 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 overflow-hidden pb-1">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={`weather-hour-skeleton-${index}`}
                  className="flex min-w-14 flex-col items-center gap-2 rounded-2xl bg-secondary px-3 py-3"
                >
                  <div className="h-3 w-8 animate-pulse rounded-full bg-muted" />
                  <div className="size-5 animate-pulse rounded-full bg-muted" />
                  <div className="h-5 w-7 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
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

            {weatherNotice ? (
              <div className="mt-4 rounded-2xl border border-life-alert/25 bg-life-alert/10 px-3 py-3 text-sm leading-6 text-life-alert">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{weatherNotice}</span>
                  </div>
                  <button
                    type="button"
                    disabled={weatherLoading}
                    className="shrink-0 cursor-pointer rounded-full bg-background/70 px-3 py-1 text-xs font-semibold text-life-alert transition hover:bg-background disabled:cursor-default disabled:opacity-60"
                    onClick={handleRefreshWeather}
                  >
                    {weatherLoading ? '重试中' : '重试'}
                  </button>
                </div>
              </div>
            ) : null}

            {weatherAlerts.length > 0 ? (
              <div className="mt-4 grid gap-2" data-today-stagger>
                {weatherAlerts.map((alert) => {
                  const tone = adviceToneClasses[alert.tone];

                  return (
                    <div
                      key={alert.id}
                      className={`rounded-2xl border px-3 py-3 ${tone.bg} ${
                        alert.tone === 'alert'
                          ? 'border-life-alert/25'
                          : alert.tone === 'health'
                            ? 'border-life-health/25'
                            : 'border-life-weather/25'
                      }`}
                    >
                      <div className={`flex items-center gap-2 text-sm font-semibold ${tone.text}`}>
                        <AlertTriangle className="size-4" />
                        {alert.title}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{alert.detail}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}

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
          </>
        )}
      </Card>

      <Card
        className="relative min-h-[168px] overflow-hidden border-life-ai/20 p-5 shadow-[0_18px_70px_rgba(6,182,212,0.08)]"
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
          <div className="min-w-0 flex-1">
            <div data-ai-brief-copy>
              <Badge tone="ai">AI 今日简报</Badge>
            </div>
            <div className="mt-3 min-h-[96px]">
              {showBriefSkeleton ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-life-ai">
                    <ActionLoadingIcon className="size-3.5" tone="ai" />
                    <span>正在生成今日简报</span>
                  </div>
                  <div className="h-6 w-44 animate-pulse rounded-full bg-life-ai/15" />
                  <div className="space-y-2">
                    <div className="h-3.5 w-full animate-pulse rounded-full bg-secondary" />
                    <div className="h-3.5 w-4/5 animate-pulse rounded-full bg-secondary" />
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-300 motion-reduce:animate-none">
                  <h2 className="line-clamp-1 text-xl font-semibold">{aiBriefTitle}</h2>
                  <p className="mt-2 line-clamp-3 min-h-[72px] text-sm leading-6 text-muted-foreground">
                    {aiBriefDetail}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4" data-today-entrance>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="trace">今日打卡</Badge>
              {checkinsLoading ? <ActionLoadingIcon className="size-3.5" tone="trace" /> : null}
            </div>
            <h2 className="mt-2 text-lg font-semibold">保持一点生活节奏</h2>
          </div>
          <div className="rounded-2xl border border-life-trace/25 bg-life-trace/10 px-3 py-2 text-sm font-bold text-life-trace">
            {habitProgress}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {habitNames.map((name) => {
            const checkin = todayCheckins.find((item) => item.name === name);
            const completed = Boolean(checkin?.completed);
            const toggling = Boolean(checkinTogglingByName[name]);

            return (
              <button
                type="button"
                key={name}
                disabled={toggling}
                className={`flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-2xl border px-3 text-left text-sm font-semibold transition disabled:cursor-default disabled:opacity-70 ${
                  completed
                    ? 'border-life-trace/40 bg-life-trace/10 text-life-trace'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => handleToggleCheckin(name)}
              >
                <span className="truncate">{name}</span>
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full border transition ${
                    toggling
                      ? 'border-life-trace/40 bg-transparent text-life-trace'
                      : completed
                        ? 'border-life-trace bg-life-trace text-background'
                        : 'border-border bg-transparent'
                  }`}
                >
                  {toggling ? (
                    <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
                  ) : completed ? (
                    <Check className="size-3.5" />
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        {checkinsError ? (
          <p className="mt-3 text-sm text-life-alert">{checkinsError}</p>
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{checkinAdviceText}</p>
        )}
      </Card>

      <Card
        className="relative overflow-hidden border-life-health/25 p-4 shadow-[0_18px_64px_rgba(34,197,94,0.08)]"
        data-today-entrance
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-health/70 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 right-8 size-24 rounded-full bg-life-health/10 blur-3xl"
        />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl border border-life-health/20 bg-life-health/10 text-life-health shadow-[0_10px_35px_rgba(34,197,94,0.10)]">
              <Bell className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="health">下一个提醒</Badge>
                {nextReminder ? (
                  <span className="text-xs text-muted-foreground">{nextReminder.relativeText}</span>
                ) : null}
              </div>
              {nextReminder ? (
                <div className="mt-2">
                  <h2 className="truncate text-base font-semibold">{nextReminder.plan.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {nextReminder.dateText} {nextReminder.timeText}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  还没有可提醒的计划。创建计划时打开提醒，首页会自动显示最近一项。
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => navigate('/plans')}
          >
            查看
          </button>
        </div>
      </Card>

      <section>
        <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">今日建议</h2>
          <Badge
            tone={remoteAdvice ? 'ai' : 'default'}
            className="min-w-[92px] justify-center gap-1.5"
          >
            {adviceLoading || adviceRefreshing ? <ActionLoadingIcon className="size-3.5" /> : null}
            {adviceStatusText}
          </Badge>
        </div>
        {adviceRefreshing ? (
          <p className="mb-3 text-xs leading-5 text-muted-foreground">
            正在根据最新天气、计划和打卡后台刷新，当前卡片先保持可用。
          </p>
        ) : null}
        <div className="grid min-h-[360px] grid-cols-2 gap-3">
          {showAdviceSkeleton
            ? Array.from({ length: 6 }).map((_, index) => (
                <Card
                  key={`advice-skeleton-${index}`}
                  className="relative h-28 overflow-hidden border-border/70 p-4"
                >
                  <div className="flex items-center gap-2 pr-10">
                    <div className="size-8 shrink-0 animate-pulse rounded-xl bg-secondary" />
                    <div className="h-4 w-16 animate-pulse rounded-full bg-secondary" />
                  </div>
                  <div className="mt-4 h-3 w-full animate-pulse rounded-full bg-secondary" />
                  <div className="mt-2 h-3 w-3/4 animate-pulse rounded-full bg-secondary" />
                </Card>
              ))
            : null}
          {showAdviceEmpty ? (
            <Card className="col-span-2 min-h-[360px] p-5 text-sm leading-6 text-muted-foreground">
              AI 建议正在生成，完成后会自动替换到这里。为了避免混淆，未完成前不会显示临时建议。
            </Card>
          ) : null}
          {advice.map((item) => {
            const Icon = item.icon;
            const tone = adviceToneClasses[item.tone];
            const isAdded = hasAdvicePlan(plans, item.id);
            const adding = addingAdviceId === item.id && planCreating;

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
                  disabled={isAdded || planCreating}
                  className="absolute top-3 right-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-secondary text-foreground transition duration-200 hover:scale-105 hover:bg-accent active:scale-95 disabled:cursor-default disabled:text-life-trace disabled:opacity-100 disabled:hover:scale-100"
                  aria-label={isAdded ? '已添加计划' : `添加${item.title}计划`}
                  onClick={() => void handleAddAdvicePlan(item)}
                  data-advice-action
                >
                  {adding ? (
                    <ActionLoadingIcon className="size-4" />
                  ) : isAdded ? (
                    <Check className="size-4" />
                  ) : (
                    <Plus className="size-4" />
                  )}
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
