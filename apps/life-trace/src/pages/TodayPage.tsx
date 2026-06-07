import {
  AlertTriangle,
  Bell,
  Check,
  Cloud,
  Droplets,
  LoaderCircle,
  MapPin,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Settings,
  Sun,
  Wind,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchLifeTraceWeather,
  type WeatherApiDay,
  type WeatherApiHour,
  type WeatherApiResponse,
} from '@/api/weather';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AnimatedWeatherIcon } from '@/components/AnimatedWeatherIcon';
import { LocationPicker } from '@/components/LocationPicker';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { weatherMetrics } from '@/data/mock';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { formatLocationDisplay, getWeatherLocationLabel } from '@/lib/location';
import {
  getPantryCoverUrl,
  getPantryExpiryText,
  getPantryStatusTone,
  resolvePantryStatus,
  sortPantryItems,
} from '@/lib/pantry';
import { isOverduePlan, isTodayPlan } from '@/lib/planGroups';
import { getNextReminder, getPlanDisplayTimeParts } from '@/lib/planReminder';
import { getLocalISODate } from '@/lib/planSchedule';
import { cn } from '@/lib/utils';
import { buildWeatherAlerts } from '@/lib/weatherAdvice';
import { readWeatherCache, writeWeatherCache } from '@/lib/weatherCache';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

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

const weatherAlertToneClasses = {
  weather: { bg: 'bg-life-weather/10', text: 'text-life-weather' },
  health: { bg: 'bg-life-health/10', text: 'text-life-health' },
  alert: { bg: 'bg-life-alert/10', text: 'text-life-alert' },
};

type WeatherDayTab = 'today' | 'tomorrow';

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
  hourly: buildFallbackHourlyWeather(),
  daily: buildFallbackDailyWeather(),
  indices: [],
  cached: false,
};

function buildFallbackHourlyWeather(): WeatherApiHour[] {
  const now = new Date();
  const currentHour = new Date(now);
  currentHour.setMinutes(0, 0, 0);
  const todayKey = formatDateKey(now);
  const forecastHours = Array.from({ length: 36 }, (_, index) => {
    const date = new Date(currentHour.getTime() + (index + 1) * 60 * 60 * 1000);
    const hour = date.getHours();
    const isTomorrow = formatDateKey(date) !== todayKey;

    return {
      time: `${String(hour).padStart(2, '0')}时`,
      dateTime: date.toISOString(),
      temp: `${getFallbackHourlyTemp(hour, isTomorrow)}°`,
      text: getFallbackHourlyText(hour, isTomorrow),
    };
  });

  return [
    { time: '现在', dateTime: now.toISOString(), temp: '22°', text: '多云', active: true },
    ...forecastHours,
  ];
}

function getFallbackHourlyTemp(hour: number, isTomorrow: boolean) {
  const timeline = [
    18, 18, 17, 17, 17, 18, 19, 21, 23, 24, 25, 26, 26, 25, 24, 23, 22, 21, 20, 19, 19, 18, 18, 18,
  ];
  const baseTemp = timeline[hour] ?? 22;
  return isTomorrow ? baseTemp - 1 : baseTemp;
}

function getFallbackHourlyText(hour: number, isTomorrow: boolean) {
  if (isTomorrow) {
    if (hour <= 9) {
      return '小雨';
    }
    if (hour <= 17) {
      return '阴';
    }
    return '多云';
  }

  if (hour <= 5) {
    return '阴';
  }
  if (hour <= 9) {
    return '多云';
  }
  if (hour <= 16) {
    return '晴';
  }
  if (hour <= 20) {
    return '多云';
  }
  return '阴';
}

function buildFallbackDailyWeather(): WeatherApiDay[] {
  const today = new Date();
  return [
    {
      date: formatDateKey(today),
      high: '26°',
      low: '17°',
      textDay: '多云',
    },
    {
      date: formatDateKey(new Date(today.getTime() + 24 * 60 * 60 * 1000)),
      high: '25°',
      low: '18°',
      textDay: '小雨',
    },
    {
      date: formatDateKey(new Date(today.getTime() + 48 * 60 * 60 * 1000)),
      high: '27°',
      low: '19°',
      textDay: '晴',
    },
  ];
}

function formatDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseWeatherHourDateTime(dateTime?: string) {
  if (!dateTime) {
    return null;
  }
  const parsed = new Date(dateTime);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildWeatherDayLabel(dateText: string, fallbackLabel: string) {
  const parsed = new Date(`${dateText}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return fallbackLabel;
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(parsed);
}

export function TodayPage() {
  const plans = useLifeTraceStore((state) => state.plans);
  const plansLoaded = useLifeTraceStore((state) => state.plansLoaded);
  const checkins = useLifeTraceStore((state) => state.checkins);
  const checkinsDate = useLifeTraceStore((state) => state.checkinsDate);
  const checkinsLoading = useLifeTraceStore((state) => state.checkinsLoading);
  const checkinsError = useLifeTraceStore((state) => state.checkinsError);
  const checkinTogglingByName = useLifeTraceStore((state) => state.checkinTogglingByName);
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const pantryListItems = useLifeTraceStore((state) => state.pantryListItems);
  const pantryListLoaded = useLifeTraceStore((state) => state.pantryListLoaded);
  const pantryListLoading = useLifeTraceStore((state) => state.pantryListLoading);
  const pantryListSummary = useLifeTraceStore((state) => state.pantryListSummary);
  const pantryListResolvedHouseholdName = useLifeTraceStore(
    (state) => state.pantryListResolvedHouseholdName,
  );
  const updateSettings = useLifeTraceStore((state) => state.updateSettings);
  const loadPantryList = useLifeTraceStore((state) => state.loadPantryList);
  const loadPlans = useLifeTraceStore((state) => state.loadPlans);
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
  const [selectedWeatherDay, setSelectedWeatherDay] = useState<WeatherDayTab>('today');
  const pageRef = useRef<HTMLDivElement>(null);
  const showToast = useFeedbackToastStore((state) => state.showToast);
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
  const habitNames = settings.habits;
  const todayCheckins = checkinsDate === todayDate ? checkins : [];
  const pantryHouseholdName = pantryListResolvedHouseholdName || preferredPantryHouseholdName;
  const pantryOverview = pantryListSummary;
  const pantryAttentionTotal = pantryOverview.expiring + pantryOverview.expired;
  const pantryCardLoading =
    Boolean(token) && (!settingsLoaded || !pantryListLoaded || pantryListLoading);
  let pantryPrioritySummary = '今天没有临期或过期条目。';
  if (pantryCardLoading) {
    pantryPrioritySummary = '正在同步库存，稍后按到期优先级展示。';
  } else if (pantryAttentionTotal > 0) {
    pantryPrioritySummary = `${pantryOverview.expiring} 件临期，${pantryOverview.expired} 件已过期。`;
  }
  const pantryPreviewItems = useMemo(
    () =>
      sortPantryItems(pantryListItems)
        .filter((item) => {
          const status = resolvePantryStatus(item);
          return status === 'expiring' || status === 'expired';
        })
        .slice(0, 3),
    [pantryListItems],
  );
  const weatherLocationLabel = getWeatherLocationLabel(weather.city, settings.city);
  const profileLocationLabel = formatLocationDisplay(settings.city) || settings.city;
  const showWeatherSkeleton = !weatherReady;
  const weatherAlertCards = useMemo(
    () => (settings.weatherAlerts ? buildWeatherAlerts(weather) : []),
    [settings.weatherAlerts, weather],
  );
  const todayDateKey = useMemo(() => formatDateKey(new Date()), []);
  const tomorrowDateKey = useMemo(
    () => formatDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    [],
  );
  const todayWeather = useMemo(
    () => weather.daily.find((item) => item.date === todayDateKey) ?? weather.daily[0] ?? null,
    [todayDateKey, weather.daily],
  );
  const tomorrowWeather = useMemo(
    () =>
      weather.daily.find((item) => item.date === tomorrowDateKey) ??
      weather.daily.find((item) => item.date !== todayWeather?.date) ??
      weather.daily[1] ??
      null,
    [todayWeather?.date, tomorrowDateKey, weather.daily],
  );
  const todayHourlyWeather = useMemo(
    () =>
      weather.hourly.filter((item) => {
        if (item.active) {
          return true;
        }
        const parsed = parseWeatherHourDateTime(item.dateTime);
        return parsed ? formatDateKey(parsed) === todayDateKey : true;
      }),
    [todayDateKey, weather.hourly],
  );
  const tomorrowHourlyWeather = useMemo(
    () =>
      weather.hourly.filter((item) => {
        const parsed = parseWeatherHourDateTime(item.dateTime);
        return parsed ? formatDateKey(parsed) === tomorrowDateKey : false;
      }),
    [tomorrowDateKey, weather.hourly],
  );
  const hasTomorrowHourlyWeather = tomorrowHourlyWeather.length > 0;
  const displayedHourlyWeather =
    selectedWeatherDay === 'tomorrow' ? tomorrowHourlyWeather : todayHourlyWeather;
  const tomorrowWeatherSummary = useMemo(() => {
    if (!tomorrowWeather) {
      return null;
    }
    const rainy = tomorrowHourlyWeather.some((item) => item.text.includes('雨'));
    return {
      label: buildWeatherDayLabel(tomorrowWeather.date, '明天'),
      detail: rainy ? '明天有降雨信号，出门记得带伞。' : `明天以${tomorrowWeather.textDay}为主。`,
    };
  }, [tomorrowHourlyWeather, tomorrowWeather]);
  const weatherNotice = weatherError || weather.warning || '';
  const showWeatherNotice =
    Boolean(weatherNotice) &&
    weather.source !== 'mock' &&
    !weatherError.includes('已显示本地参考天气') &&
    !weatherError.includes('已保留当前天气');
  const nextReminder = getNextReminder(plans);
  const todayOpenPlans = useMemo(
    () => plans.filter((plan) => !plan.completed && isTodayPlan(plan)),
    [plans],
  );
  const overduePlans = useMemo(
    () => plans.filter((plan) => !plan.completed && isOverduePlan(plan)),
    [plans],
  );
  const previewPlans =
    overduePlans.length > 0 ? overduePlans.slice(0, 3) : todayOpenPlans.slice(0, 3);
  const planPulseText =
    overduePlans.length > 0
      ? `${overduePlans.length} 个计划已过时间，建议先处理一个。`
      : todayOpenPlans.length > 0
        ? `今天还有 ${todayOpenPlans.length} 个计划，完成后会自动沉淀为踪迹。`
        : '今天还没有未完成计划，可以进入计划页手动创建。';
  const completedHabitCount = habitNames.filter((name) =>
    todayCheckins.some((item) => item.name === name && item.completed),
  ).length;
  const habitProgress =
    habitNames.length > 0 ? `${completedHabitCount}/${habitNames.length}` : '未设置';
  const checkinAdviceText =
    habitNames.length === 0
      ? '先去我的页添加自定义打卡，比如喝药、维生素或饭后散步。'
      : completedHabitCount > 0
        ? `已完成 ${completedHabitCount} 项，今天继续按这个节奏就很好。`
        : '先完成一个小打卡，今天会更容易进入状态。';

  useLifeTraceEntrance(pageRef, {
    selector: '[data-today-entrance], [data-today-stagger]',
    y: 20,
    scale: 0.985,
    stagger: 0.06,
    delay: 0.03,
    duration: 0.62,
    ease: 'power3.out',
  });

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
    if (!token || !settingsLoaded) {
      return;
    }

    void loadCheckins(todayDate);
  }, [loadCheckins, settingsLoaded, todayDate, token]);

  useEffect(() => {
    if (!token || !settingsLoaded) {
      return;
    }

    void loadPlans({ status: 'open', pageSize: 20 });
  }, [loadPlans, settingsLoaded, token]);

  useEffect(() => {
    if (!token || !settingsLoaded) {
      return;
    }

    void loadPantryList({
      householdId: preferredPantryHouseholdId || undefined,
      status: 'all',
      category: 'all',
      q: '',
      pageSize: 20,
    });
  }, [loadPantryList, preferredPantryHouseholdId, settingsLoaded, token]);

  const pantryPageHref = '/pantry';

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
        showToast(resp.refreshLimited ? '刚刚刷新过，已使用缓存天气' : '天气已刷新', 'info');
      })
      .catch(() => {
        setWeatherError('天气刷新失败，已保留当前天气');
        showToast('天气刷新失败，稍后再试', 'warning');
      })
      .finally(() => setWeatherLoading(false));
  };

  const handleToggleCheckin = (name: string) => {
    const current = todayCheckins.find((item) => item.name === name);
    void toggleHabitCheckin(todayDate, name, !current?.completed);
  };

  return (
    <div ref={pageRef} className="min-w-0 space-y-5 overflow-x-hidden">
      <header className="flex min-w-0 items-start justify-between gap-3" data-today-entrance>
        <div className="min-w-0">
          <h1 className="truncate text-3xl font-bold tracking-tight max-[360px]:text-2xl">
            Life Trace
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <LocationPicker
              value={settings.city}
              onChange={(value) => updateSettings({ city: value })}
            >
              {({ displayValue, openPicker }) => (
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-2 rounded-full px-1 py-0.5 text-left transition hover:text-foreground"
                  onClick={openPicker}
                >
                  <MapPin className="size-4 shrink-0" />
                  <span className="truncate">
                    {weatherReady ? weatherLocationLabel : displayValue || profileLocationLabel}
                  </span>
                </button>
              )}
            </LocationPicker>
            <span>·</span>
            <span className="shrink-0">{todayLabel}</span>
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

      <Card className="min-w-0 overflow-hidden p-5 max-[360px]:p-4" data-today-entrance>
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
            <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
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
            <div className="mb-7 flex min-w-0 items-center justify-between gap-3 max-[360px]:items-start">
              <div className="flex min-w-0 items-center gap-4 max-[360px]:gap-3" data-today-stagger>
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-life-weather/10 text-life-weather max-[360px]:size-14">
                  <AnimatedWeatherIcon text={weather.now.text} size="hero" />
                </div>
                <div className="min-w-0">
                  <div className="text-6xl font-light leading-none tracking-[-0.04em] max-[360px]:text-5xl">
                    {weather.now.temp}°
                  </div>
                  <div className="mt-2 truncate text-lg text-muted-foreground max-[360px]:text-base">
                    {weather.now.text}
                  </div>
                </div>
              </div>
              <div
                className="min-w-0 max-w-[44%] text-right max-[360px]:max-w-[42%]"
                data-today-stagger
              >
                <div className="truncate text-xl font-semibold max-[360px]:text-base">
                  {weather.now.high}° /{' '}
                  <span className="text-muted-foreground">{weather.now.low}°</span>
                </div>
                <div className="mt-1 truncate text-sm text-muted-foreground">
                  {weatherLocationLabel}
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-end gap-2 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate">
                    {weatherLoading
                      ? '更新中'
                      : weather.source === 'qweather'
                        ? weather.cached
                          ? 'QWeather · 缓存'
                          : 'QWeather'
                        : '参考天气'}
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

            <div className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
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
                    <span className="shrink-0 text-sm font-semibold">{metric.value}</span>
                  </div>
                );
              })}
            </div>

            {showWeatherNotice ? (
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

            <div
              className={cn(
                'mt-4 grid gap-3',
                settings.weatherAlerts && 'min-[720px]:grid-cols-[1.4fr_1fr]',
              )}
              data-today-stagger
            >
              {settings.weatherAlerts ? (
                weatherAlertCards.length > 0 ? (
                  <div className="grid gap-2">
                    {weatherAlertCards.map((alert) => {
                      const tone = weatherAlertToneClasses[alert.tone];

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
                          <div
                            className={`flex items-center gap-2 text-sm font-semibold ${tone.text}`}
                          >
                            <AlertTriangle className="size-4" />
                            {alert.title}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {alert.detail}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-life-weather/20 bg-life-weather/5 px-3 py-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-life-weather">
                      <Sun className="size-4" />
                      今日天气平稳
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      当前没有明显风险提醒，按正常节奏安排出门和通勤就好。
                    </p>
                  </div>
                )
              ) : null}

              {tomorrowWeatherSummary && tomorrowWeather ? (
                <div className="rounded-2xl border border-border bg-secondary/40 px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <AnimatedWeatherIcon
                          text={tomorrowWeather.textDay}
                          size="compact"
                          className="text-life-plan"
                        />
                        明日天气
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {tomorrowWeatherSummary.label}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {tomorrowWeather.high} /{' '}
                        <span className="text-muted-foreground">{tomorrowWeather.low}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {tomorrowWeather.textDay}
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {tomorrowWeatherSummary.detail}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-5" data-today-stagger>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">小时天气</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedWeatherDay === 'today'
                      ? '查看今天剩余的逐小时天气变化'
                      : '查看明天可用的逐小时天气预报'}
                  </p>
                </div>
                <div className="inline-flex rounded-2xl bg-secondary p-1">
                  <button
                    type="button"
                    className={cn(
                      'rounded-xl px-3 py-2 text-xs font-semibold transition',
                      selectedWeatherDay === 'today'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground',
                    )}
                    onClick={() => setSelectedWeatherDay('today')}
                  >
                    今日
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'rounded-xl px-3 py-2 text-xs font-semibold transition',
                      selectedWeatherDay === 'tomorrow'
                        ? 'bg-card text-foreground shadow-sm'
                        : hasTomorrowHourlyWeather
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/80',
                    )}
                    onClick={() => setSelectedWeatherDay('tomorrow')}
                  >
                    明日
                  </button>
                </div>
              </div>
              {selectedWeatherDay === 'tomorrow' && !hasTomorrowHourlyWeather ? (
                <div className="rounded-2xl border border-dashed border-border px-4 py-4 text-sm leading-6 text-muted-foreground">
                  明日逐小时天气还没返回，先看上面的明日天气概览，稍后再来会更完整。
                </div>
              ) : (
                <div className="-mx-1 flex max-w-full gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {displayedHourlyWeather.map((item, index) => {
                    const isActiveHour = item.active && selectedWeatherDay === 'today';

                    return (
                      <div
                        key={`${item.dateTime || item.time}-${index}`}
                        className={cn(
                          'flex min-w-20 shrink-0 flex-col items-center gap-1.5 rounded-2xl px-3 py-3',
                          isActiveHour
                            ? 'bg-life-weather/15 text-life-weather'
                            : 'bg-secondary text-muted-foreground',
                        )}
                      >
                        <span className="text-xs font-medium">{item.time}</span>
                        <AnimatedWeatherIcon text={item.text} size="hourly" />
                        <span className="text-base font-semibold leading-none text-foreground">
                          {item.temp}
                        </span>
                        <span
                          className={cn(
                            'max-w-16 truncate text-[11px] font-medium leading-none',
                            isActiveHour ? 'text-life-weather' : 'text-muted-foreground',
                          )}
                          title={item.text}
                        >
                          {item.text}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </Card>

      <Card
        className="relative overflow-hidden border-life-health/20 p-4 shadow-[0_18px_64px_rgba(34,197,94,0.08)]"
        data-today-entrance
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-life-health/70 to-transparent"
        />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={pantryOverview.expired > 0 ? 'alert' : 'health'}>家中临期</Badge>
              {pantryHouseholdName && !pantryCardLoading ? (
                <span className="text-xs text-muted-foreground">
                  当前空间：{pantryHouseholdName}
                </span>
              ) : null}
              {pantryOverview.expired > 0 && !pantryCardLoading ? (
                <span className="text-xs text-life-alert">{pantryOverview.expired} 件已过期</span>
              ) : null}
            </div>
            <h2 className="mt-2 text-lg font-semibold">今天该先处理哪几样</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{pantryPrioritySummary}</p>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus:outline-none focus:ring-2 focus:ring-life-health/30"
            onClick={() => navigate(pantryPageHref)}
          >
            查看
          </button>
        </div>
        {pantryCardLoading ? (
          <div
            className="rounded-[1.15rem] border border-life-health/15 bg-life-health/5 px-4 py-4"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="flex items-center gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/12 text-life-health">
                <ActionLoadingIcon tone="health" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">正在整理库存优先级</p>
                  <RefreshCw className="size-3.5 animate-spin text-life-health motion-reduce:animate-none" />
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  当前空间、临期和过期状态正在同步。
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {[0, 1, 2].map((index) => (
                <div
                  key={`pantry-loading-${index}`}
                  className="flex items-center gap-3 rounded-2xl bg-card/60 px-3 py-2.5"
                >
                  <div className="size-9 shrink-0 animate-pulse rounded-2xl bg-life-health/15 motion-reduce:animate-none" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div
                      className={cn(
                        'h-3 animate-pulse rounded-full bg-secondary motion-reduce:animate-none',
                        index === 0 ? 'w-24' : index === 1 ? 'w-32' : 'w-20',
                      )}
                    />
                    <div className="h-2.5 w-full animate-pulse rounded-full bg-secondary/70 motion-reduce:animate-none" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : pantryPreviewItems.length > 0 ? (
          <div className="space-y-2">
            {pantryPreviewItems.map((item) => {
              const status = resolvePantryStatus(item);
              const coverUrl = getPantryCoverUrl(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-secondary px-3 py-3 text-left transition hover:border-foreground/20"
                  onClick={() => navigate(pantryPageHref)}
                >
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={item.name}
                      className="size-12 shrink-0 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
                      <AlertTriangle className="size-5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.location} · {getPantryExpiryText(item)}
                    </p>
                  </div>
                  <Badge tone={getPantryStatusTone(status)}>
                    {status === 'expired' ? '过期' : '临期'}
                  </Badge>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[1.15rem] border border-dashed border-life-health/25 bg-life-health/5 px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-health/12 text-life-health">
                <PackageCheck className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">今天没有紧急库存</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  先补一件常忘的食品或用品，后面会自动排到这里。
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-card/70 px-3 py-3">
                <p className="text-[11px] font-medium text-muted-foreground">临期</p>
                <p className="mt-1 text-lg font-semibold text-life-health">
                  {pantryOverview.expiring}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">件</span>
                </p>
              </div>
              <div className="rounded-2xl bg-card/70 px-3 py-3">
                <p className="text-[11px] font-medium text-muted-foreground">过期</p>
                <p className="mt-1 text-lg font-semibold text-life-alert">
                  {pantryOverview.expired}
                  <span className="ml-1 text-xs font-medium text-muted-foreground">件</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-life-health/12 px-4 text-sm font-semibold text-life-health transition hover:bg-life-health/18 focus:outline-none focus:ring-2 focus:ring-life-health/30"
              onClick={() => navigate(pantryPageHref)}
            >
              <PackageOpen className="size-4" />
              去补库存
            </button>
          </div>
        )}
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
        {habitNames.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 max-[340px]:grid-cols-1">
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
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-4 py-4">
            <p className="text-sm leading-6 text-muted-foreground">
              还没有设置今天要坚持的打卡项。去我的页新增后，这里就会直接按云端清单展示。
            </p>
            <button
              type="button"
              className="mt-3 inline-flex h-9 items-center rounded-xl bg-secondary px-3 text-sm font-semibold text-foreground transition hover:bg-secondary/80"
              onClick={() => navigate('/profile')}
            >
              去设置打卡
            </button>
          </div>
        )}
        {checkinsError ? (
          <p className="mt-3 text-sm text-life-alert">{checkinsError}</p>
        ) : (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{checkinAdviceText}</p>
        )}
      </Card>

      <Card className="p-4" data-today-entrance>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Badge tone={overduePlans.length > 0 ? 'alert' : 'plan'}>今日计划</Badge>
            <h2 className="mt-2 text-lg font-semibold">
              {overduePlans.length > 0 ? '先处理逾期计划' : '今天要推进什么'}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{planPulseText}</p>
          </div>
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded-full bg-secondary px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => navigate('/plans')}
          >
            管理
          </button>
        </div>
        {nextReminder ? (
          <button
            type="button"
            className="mb-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-secondary px-3 py-3 text-left transition hover:bg-secondary/80"
            onClick={() => navigate(`/plans/${nextReminder.plan.id}`)}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-life-health/10 text-life-health">
              <Bell className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-semibold text-life-health">
                <span>下一次提醒</span>
                <span className="text-muted-foreground">{nextReminder.relativeText}</span>
              </span>
              <span className="mt-1 block truncate text-sm font-semibold">
                {nextReminder.plan.title}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {nextReminder.dateText} {nextReminder.timeText}
              </span>
            </span>
          </button>
        ) : null}
        {plansLoaded ? (
          previewPlans.length > 0 ? (
            <div className="space-y-2">
              {previewPlans.map((plan) => {
                const { dateText, timeText } = getPlanDisplayTimeParts(plan);
                const overdue = isOverduePlan(plan);

                return (
                  <button
                    type="button"
                    key={plan.id}
                    className={cn(
                      'flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl border px-3 py-3 text-left transition hover:border-foreground/20',
                      overdue
                        ? 'border-life-alert/30 bg-life-alert/10'
                        : 'border-border bg-secondary',
                    )}
                    onClick={() => navigate(`/plans/${plan.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{plan.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateText} {timeText}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                        overdue
                          ? 'bg-life-alert/15 text-life-alert'
                          : 'bg-life-plan/10 text-life-plan',
                      )}
                    >
                      {overdue ? '逾期' : plan.type}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm leading-6 text-muted-foreground">
              今天还没有计划。可以进入计划页手动创建，或在 AI 给出明确事项时加入计划。
            </div>
          )
        ) : (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`today-plan-skeleton-${index}`}
                className="h-16 animate-pulse rounded-2xl bg-secondary"
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
