import {
  CalendarDays,
  Camera,
  ChevronRight,
  Leaf,
  PackageOpen,
  PenLine,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchLifeTraceWeather, type WeatherApiResponse } from '@/api/weather';
import { AnimatedWeatherIcon } from '@/components/AnimatedWeatherIcon';
import { LifePage } from '@/components/LifeLayout';
import { Card } from '@/components/ui/card';
import { useLifeTraceEntrance } from '@/hooks/useLifeTraceEntrance';
import { getPantryCoverUrl, resolvePantryStatus, sortPantryItems } from '@/lib/pantry';
import { isOverduePlan, isTodayPlan } from '@/lib/planGroups';
import { getPlanDisplayTimeParts } from '@/lib/planReminder';
import { cn } from '@/lib/utils';
import { readWeatherCache, writeWeatherCache } from '@/lib/weatherCache';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

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
  metrics: [],
  hourly: [],
  daily: [],
  indices: [],
  cached: false,
};

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-full bg-secondary motion-reduce:animate-none',
        className,
      )}
    />
  );
}

function TodayPlanSkeleton() {
  return (
    <div className="space-y-2">
      <span className="sr-only">正在加载今日计划</span>
      {[0, 1].map((index) => (
        <div
          key={`today-plan-skeleton-${index}`}
          className="flex h-16 items-center justify-between gap-3 rounded-2xl bg-secondary px-3"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBar className={cn('h-3', index === 0 ? 'w-36' : 'w-28')} />
            <SkeletonBar className="h-2.5 w-24 bg-muted" />
          </div>
          <SkeletonBar className="h-6 w-12 shrink-0 bg-life-plan/12" />
        </div>
      ))}
    </div>
  );
}

export function TodayPage() {
  const plans = useLifeTraceStore((state) => state.plans);
  const plansLoaded = useLifeTraceStore((state) => state.plansLoaded);
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const pantryListItems = useLifeTraceStore((state) => state.pantryListItems);
  const pantryListSummary = useLifeTraceStore((state) => state.pantryListSummary);
  const recentAchievements = useLifeTraceStore((state) => state.recentAchievements);
  const loadPantryList = useLifeTraceStore((state) => state.loadPantryList);
  const loadPlans = useLifeTraceStore((state) => state.loadPlans);
  const shoppingListItems = useLifeTraceStore((state) => state.shoppingListItems);
  const shoppingListLoaded = useLifeTraceStore((state) => state.shoppingListLoaded);
  const loadShoppingList = useLifeTraceStore((state) => state.loadShoppingList);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherApiResponse>({
    ...fallbackWeather,
    city: settings.city,
  });
  const [weatherReady, setWeatherReady] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
      }).format(new Date()),
    [],
  );
  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 5) {
      return '晚上好';
    }
    if (hour < 11) {
      return '早上好';
    }
    if (hour < 14) {
      return '中午好';
    }
    if (hour < 18) {
      return '下午好';
    }
    return '晚上好';
  }, []);
  const pantryOverview = pantryListSummary;
  const pantryAttentionTotal = pantryOverview.expiring + pantryOverview.expired;
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
  const todayOpenPlans = useMemo(
    () => plans.filter((plan) => !plan.completed && isTodayPlan(plan)),
    [plans],
  );
  const overduePlans = useMemo(
    () => plans.filter((plan) => !plan.completed && isOverduePlan(plan)),
    [plans],
  );
  const planCardLoading = Boolean(token) && !plansLoaded;
  const previewPlans =
    overduePlans.length > 0 ? overduePlans.slice(0, 3) : todayOpenPlans.slice(0, 3);
  const greetingName = user?.nickname?.trim() || user?.username?.trim();
  const latestAchievement = recentAchievements[0];
  const firstPreviewPlan = previewPlans[0];
  const firstPreviewPlanTime = firstPreviewPlan ? getPlanDisplayTimeParts(firstPreviewPlan) : null;
  const nextPlanMeta = firstPreviewPlanTime
    ? `${firstPreviewPlanTime.dateText} ${firstPreviewPlanTime.timeText}`.trim()
    : todayOpenPlans.length > 0
      ? `${todayOpenPlans.length} 个计划待推进`
      : '今天还没有安排';
  const todaySummaryItems = [
    {
      label: '今日计划',
      value: `${todayOpenPlans.length}`,
      tone: 'text-life-trace',
      icon: CalendarDays,
    },
    {
      label: '近期成就',
      value: latestAchievement ? '1' : '0',
      tone: 'text-life-health',
      icon: Sparkles,
    },
    {
      label: '关注事项',
      value: pantryAttentionTotal > 0 ? `${pantryAttentionTotal}` : '0',
      tone: 'text-life-weather',
      icon: Trophy,
    },
  ];

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
      return () => controller.abort();
    }

    setWeatherReady(false);

    fetchLifeTraceWeather(settings.city, { signal: controller.signal })
      .then((resp) => {
        if (controller.signal.aborted) {
          return;
        }
        setWeather(resp);
        writeWeatherCache(window.localStorage, settings.city, resp);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setWeather({ ...fallbackWeather, city: settings.city });
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setWeatherReady(true);
        }
      });

    return () => controller.abort();
  }, [settings.city]);

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

  useEffect(() => {
    if (!token || !settingsLoaded) {
      return;
    }
    void loadShoppingList({
      householdId: preferredPantryHouseholdId || undefined,
      status: 'open',
    });
  }, [loadShoppingList, preferredPantryHouseholdId, settingsLoaded, token]);

  return (
    <LifePage ref={pageRef} variant="tab" spacing="default" className="pb-6">
      <section
        className="relative overflow-hidden px-0.5 pb-1 pt-0"
        data-scroll-anchor="today:hero"
        data-today-entrance
      >
        <div className="relative flex min-w-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="flex max-w-[15.8rem] items-center gap-2 truncate text-[1.6rem] font-semibold leading-none text-foreground max-[360px]:max-w-[12.5rem] max-[360px]:text-[1.42rem]">
              <span className="truncate">
                {greetingName ? `${greetingText}，${greetingName}` : greetingText}
              </span>
              <Leaf className="size-5 shrink-0 text-life-trace" />
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.84rem] leading-none text-muted-foreground">
              <span>{todayLabel}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2.5 text-right">
            <div className="mt-0.5 grid size-12 place-items-center text-life-weather max-[360px]:size-10">
              <AnimatedWeatherIcon
                text={weather.now.text}
                size="hero"
                iconClassName="stroke-[2.25]"
              />
            </div>
            <div className="min-w-[3.55rem]">
              <p className="text-[1.85rem] font-semibold leading-none text-foreground max-[360px]:text-[1.6rem]">
                {weatherReady ? `${weather.now.temp}°` : '--°'}
              </p>
              <p className="mt-1 truncate text-[0.76rem] leading-none text-muted-foreground">
                {weatherReady ? weather.now.text : '天气同步中'}
              </p>
              <p className="mt-1 truncate text-[0.76rem] leading-none text-muted-foreground">
                {weatherReady ? `${weather.now.low}° / ${weather.now.high}°` : ''}
              </p>
            </div>
          </div>
        </div>

        <h2 className="mt-7 px-0.5 text-[1rem] font-semibold leading-none text-foreground">
          今日节奏
        </h2>

        <div className="relative mt-4 grid grid-cols-3 divide-x divide-border/70 py-1 max-[360px]:grid-cols-1 max-[360px]:divide-x-0 max-[360px]:divide-y">
          <button
            type="button"
            className="min-w-0 px-2 text-center"
            onClick={() => navigate('/today')}
          >
            <div className="mx-auto grid size-12 place-items-center text-life-weather">
              <AnimatedWeatherIcon
                text={weather.now.text}
                size="compact"
                iconClassName="stroke-[2.4]"
              />
            </div>
            <p className="mt-2 truncate text-[0.88rem] font-semibold text-foreground">
              {weatherReady ? weather.now.text : '天气'}
            </p>
            <p className="mt-1 truncate text-[0.82rem] text-muted-foreground">
              {weatherReady ? `${weather.now.low}° / ${weather.now.high}°` : '同步中'}
            </p>
          </button>
          <button
            type="button"
            className="min-w-0 px-2 text-center"
            data-scroll-anchor={firstPreviewPlan ? `today:plan:${firstPreviewPlan.id}` : undefined}
            onClick={() => navigate(firstPreviewPlan ? `/plans/${firstPreviewPlan.id}` : '/plans')}
          >
            <div className="mx-auto grid size-12 place-items-center text-life-trace">
              <CalendarDays className="size-9 stroke-[1.8]" />
            </div>
            <p className="mt-2 truncate text-[0.88rem] font-semibold text-foreground">下个计划</p>
            <p className="mt-1 truncate text-[0.82rem] text-muted-foreground">{nextPlanMeta}</p>
          </button>
          <button
            type="button"
            className="min-w-0 px-2 text-center"
            onClick={() => navigate('/pantry')}
          >
            <div className="mx-auto grid size-12 place-items-center text-life-plan">
              <PackageOpen className="size-9 stroke-[1.8]" />
            </div>
            <p className="mt-2 truncate text-[0.88rem] font-semibold text-foreground">
              pantry 关注
            </p>
            <p className="mt-1 truncate text-[0.82rem] text-muted-foreground">
              {pantryAttentionTotal > 0 ? `${pantryAttentionTotal} 件食材不足` : '库存平稳'}
            </p>
          </button>
        </div>
      </section>

      <section
        className="mt-2 rounded-[1.25rem] bg-life-trace px-4 py-2.5 text-primary-foreground shadow-[0_12px_24px_rgba(78,143,104,0.2)]"
        data-scroll-anchor="today:quick-entry"
        data-today-entrance
      >
        <div className="flex min-h-[3.1rem] items-center gap-3">
          <button
            type="button"
            className="grid size-[2.65rem] shrink-0 place-items-center rounded-[0.82rem] bg-background text-life-trace shadow-[0_6px_14px_rgba(45,41,35,0.13)]"
            onClick={() => navigate('/plans')}
            aria-label="添加今日计划"
          >
            <PenLine className="size-[1.45rem] stroke-[2.15]" />
          </button>
          <button
            type="button"
            className="min-w-0 flex-1 whitespace-nowrap text-left text-[0.9rem] font-medium leading-none"
            onClick={() => navigate('/plans')}
          >
            添加今日计划
          </button>
          <div className="flex shrink-0 items-center gap-2.5 text-[0.68rem] font-medium leading-none text-primary-foreground/88 max-[360px]:gap-1.5 max-[360px]:text-[0.63rem]">
            <button
              type="button"
              className="inline-flex items-center gap-1 transition hover:text-primary-foreground"
              onClick={() => navigate('/traces')}
            >
              <PenLine className="size-3 stroke-[2]" />
              记想法
            </button>

            <button
              type="button"
              className="inline-flex items-center gap-1 transition hover:text-primary-foreground"
              onClick={() => navigate('/ai/photo-item-analysis')}
            >
              <Camera className="size-3 stroke-[2]" />
              拍照
            </button>
          </div>
        </div>
      </section>

      <Card
        className="overflow-hidden rounded-[1.5rem] p-4 shadow-[0_10px_30px_rgba(45,41,35,0.05)]"
        data-scroll-anchor="today:plans"
        data-today-entrance
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">今日计划</h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-secondary/75 px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => navigate('/plans')}
          >
            查看全天计划
            <ChevronRight className="size-3.5" />
          </button>
        </div>
        {planCardLoading ? (
          <TodayPlanSkeleton />
        ) : previewPlans.length > 0 ? (
          <div className="divide-y divide-border/70">
            {previewPlans.map((plan, index) => {
              const { dateText, timeText } = getPlanDisplayTimeParts(plan);
              const overdue = isOverduePlan(plan);

              return (
                <button
                  type="button"
                  key={plan.id}
                  className="grid w-full grid-cols-[4.4rem_1fr_auto] items-center gap-3 py-3.5 text-left first:pt-0 last:pb-0"
                  data-scroll-anchor={`today:plan:${plan.id}`}
                  onClick={() => navigate(`/plans/${plan.id}`)}
                >
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      overdue ? 'text-life-alert' : 'text-life-trace',
                    )}
                  >
                    {timeText || dateText || '今天'}
                  </span>
                  <span className="relative min-w-0 border-l border-border pl-5">
                    <span
                      className={cn(
                        '-left-[0.35rem] absolute top-1.5 size-2.5 rounded-full ring-4 ring-card',
                        index % 3 === 0
                          ? 'bg-life-trace'
                          : index % 3 === 1
                            ? 'bg-life-weather'
                            : 'bg-life-alert',
                      )}
                    />
                    <span className="block truncate text-base font-semibold text-foreground">
                      {plan.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {plan.location || plan.type}
                    </span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-2xl border border-dashed border-border px-4 py-5 text-left text-sm text-muted-foreground"
            onClick={() => navigate('/plans')}
          >
            今天还没有计划
            <ChevronRight className="size-4" />
          </button>
        )}
      </Card>

      <div className="grid gap-3" data-scroll-anchor="today:daily-links" data-today-entrance>
        <button
          type="button"
          className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-card/85 px-4 py-3 text-left shadow-[0_8px_24px_rgba(45,41,35,0.04)]"
          data-scroll-anchor="today:pantry-link"
          onClick={() => navigate('/pantry')}
        >
          <span className="grid size-[3.1rem] shrink-0 place-items-center rounded-[1.08rem] bg-life-health/10 text-life-health">
            <PackageOpen className="size-[1.35rem]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">Pantry 食材</span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {pantryAttentionTotal > 0
                ? `${pantryAttentionTotal} 件食材不足或临期`
                : '今天没有紧急库存'}
            </span>
          </span>
          <span className="flex shrink-0 -space-x-2">
            {pantryPreviewItems.slice(0, 3).map((item) => {
              const coverUrl = getPantryCoverUrl(item);
              return coverUrl ? (
                <img
                  key={item.id}
                  src={coverUrl}
                  alt={item.name}
                  className="size-10 rounded-[0.95rem] border border-card bg-secondary object-cover"
                />
              ) : null;
            })}
            {pantryAttentionTotal > pantryPreviewItems.length ? (
              <span className="grid size-10 place-items-center rounded-[0.95rem] bg-secondary text-xs font-semibold text-muted-foreground">
                +{pantryAttentionTotal - pantryPreviewItems.length}
              </span>
            ) : null}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>

        {shoppingListLoaded && shoppingListItems.some((entry) => !entry.checkedAt) ? (
          <button
            type="button"
            className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-card/85 px-4 py-3 text-left shadow-[0_8px_24px_rgba(45,41,35,0.04)]"
            data-scroll-anchor="today:shopping"
            onClick={() => navigate('/shopping')}
          >
            <span className="grid size-[3.1rem] shrink-0 place-items-center rounded-[1.08rem] bg-life-health/10 text-life-health">
              <ShoppingBasket className="size-[1.35rem]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold">采购清单</span>
              <span className="mt-1 block truncate text-sm text-muted-foreground">
                还有 {shoppingListItems.filter((entry) => !entry.checkedAt).length} 项待买
              </span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
          </button>
        ) : null}

        <button
          type="button"
          className="flex items-center gap-3 rounded-[1.25rem] border border-border bg-card/85 px-4 py-3 text-left shadow-[0_8px_24px_rgba(45,41,35,0.04)]"
          data-scroll-anchor="today:closet-link"
          onClick={() => navigate('/closet')}
        >
          <span className="grid size-[3.1rem] shrink-0 place-items-center rounded-[1.08rem] bg-life-weather/10 text-life-weather">
            <Shirt className="size-[1.35rem]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold">今日穿搭</span>
            <span className="mt-1 block truncate text-sm text-muted-foreground">
              {weatherReady ? `${weather.now.temp}° ${weather.now.text}` : '按今日节奏搭一套'}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </div>

      <Card
        className="rounded-[1.25rem] border-border/70 bg-card/88 p-4 shadow-[0_8px_22px_rgba(71,58,42,0.035)]"
        data-scroll-anchor="today:summary"
        data-today-entrance
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-semibold">今日小结</h2>
          <button
            type="button"
            className="text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => navigate('/traces')}
          >
            去记录
          </button>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border/70">
          {todaySummaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="min-w-0 px-3 first:pl-0 last:pr-0">
                <div
                  className={cn(
                    'mb-2 grid size-8 place-items-center rounded-[0.95rem] bg-secondary',
                    item.tone,
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <p className="text-base font-semibold leading-none">{item.value}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.label}</p>
              </div>
            );
          })}
        </div>
      </Card>
    </LifePage>
  );
}
