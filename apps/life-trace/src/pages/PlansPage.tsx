import {
  AlertTriangle,
  Bell,
  BellOff,
  Check,
  Filter,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { EmptyState } from '@/components/EmptyState';
import { PlanDetailDrawer } from '@/components/PlanDetailDrawer';
import { SyncState } from '@/components/SyncState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getVisiblePlanNote } from '@/lib/advicePlan';
import { gsap, useGSAP } from '@/lib/gsap';
import {
  filterPlans,
  filterPlansByKeywordAndType,
  isAdvicePlan,
  isOverduePlan,
  type PlanFilter,
  splitPlansByTimeline,
  splitPlansByToday,
} from '@/lib/planGroups';
import { getPlanDisplayTimeParts } from '@/lib/planReminder';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Plan, PlanType } from '@/types';

const primaryPlanFilters: Array<{ id: PlanFilter; label: string; emptyText: string }> = [
  {
    id: 'today',
    label: '今天',
    emptyText: '今天还没有计划。可以先添加一个喝水、通勤或下班后的安排。',
  },
  {
    id: 'upcoming',
    label: '未来',
    emptyText: '未来还没有安排。可以先把周末电影、饭局或运动计划放进来。',
  },
  {
    id: 'completed',
    label: '已完成',
    emptyText: '还没有完成的计划。完成一个计划后，它会沉淀成生活踪迹。',
  },
];

const planTypeOptions: Array<PlanType | 'all'> = [
  'all',
  '电影',
  '吃饭',
  '运动',
  '阅读',
  '聚会',
  '普通事项',
];

type QuickPlanFilter = 'all' | 'weekend' | 'reminded';

const quickFilterOptions: Array<{ id: QuickPlanFilter; label: string }> = [
  { id: 'all', label: '全部计划' },
  { id: 'weekend', label: '只看周末' },
  { id: 'reminded', label: '只看提醒' },
];

const typeTone: Record<PlanType, 'plan' | 'health' | 'trace' | 'weather' | 'ai' | 'alert'> = {
  电影: 'plan',
  吃饭: 'health',
  运动: 'trace',
  阅读: 'weather',
  聚会: 'ai',
  普通事项: 'alert',
};

function isTransientPlansSyncIssue(message: string) {
  return message.includes('认证服务暂时不可用') || message.includes('暂时无法验证登录状态');
}

export function PlansPage() {
  const {
    plans,
    plansError,
    plansLoading,
    plansLoadingMore,
    plansPagination,
    planCreating,
    planUpdatingById,
    planCompletingById,
    planDeletingById,
    completePlan,
    loadPlans,
    loadMorePlans,
    removePlan,
  } = useLifeTraceStore();
  const navigate = useNavigate();
  const { planId } = useParams<{ planId?: string }>();
  const pageRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [activeFilter, setActiveFilter] = useState<PlanFilter>('today');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<PlanType | 'all'>('all');
  const [quickFilter, setQuickFilter] = useState<QuickPlanFilter>('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const now = useMemo(() => new Date(), []);
  const listOptions = useMemo(
    () => ({
      pageSize: 20,
      status: activeFilter === 'completed' ? ('completed' as const) : ('open' as const),
      q: searchQuery,
      type: typeFilter,
      reminder: quickFilter === 'reminded' ? true : undefined,
    }),
    [activeFilter, quickFilter, searchQuery, typeFilter],
  );
  const visibleBasePlans = useMemo(() => {
    let nextPlans = plans;
    if (quickFilter === 'weekend') {
      nextPlans = filterPlans(nextPlans, 'weekend');
    }
    if (quickFilter === 'reminded') {
      nextPlans = filterPlans(nextPlans, 'reminded');
    }
    if (activeFilter !== 'completed') {
      nextPlans = nextPlans.filter((plan) => !plan.completed);
    }
    return nextPlans;
  }, [activeFilter, plans, quickFilter]);
  const viewPlans =
    activeFilter === 'today'
      ? visibleBasePlans
      : activeFilter === 'upcoming'
        ? filterPlans(visibleBasePlans, 'upcoming')
        : activeFilter === 'completed'
          ? filterPlans(visibleBasePlans, 'completed')
          : filterPlans(visibleBasePlans, activeFilter);
  const filteredPlans = filterPlansByKeywordAndType(viewPlans, searchQuery, typeFilter);
  const { todayPlans } = splitPlansByToday(plans);
  const timelineGroups = splitPlansByTimeline(filteredPlans, now);
  const overdueCount = splitPlansByTimeline(plans, now).overduePlans.length;
  const activeFilterConfig =
    primaryPlanFilters.find((filter) => filter.id === activeFilter) ?? primaryPlanFilters[0];
  const planGroups = [
    ...(activeFilter === 'today'
      ? [
          { title: '已逾期', plans: timelineGroups.overduePlans, tone: 'text-life-alert' },
          { title: '今日计划', plans: timelineGroups.todayPlans, tone: '' },
          {
            title: '未排期',
            plans: timelineGroups.unscheduledPlans,
            tone: 'text-muted-foreground',
          },
        ]
      : []),
    ...(activeFilter === 'upcoming'
      ? [{ title: '未来安排', plans: timelineGroups.upcomingPlans, tone: 'text-life-ai' }]
      : []),
    { title: '已完成', plans: timelineGroups.completedPlans, tone: 'text-life-trace' },
  ].filter((group) => group.plans.length > 0);
  const selectedPlan = planId ? (plans.find((plan) => plan.id === planId) ?? null) : null;
  const deletePending = deleteTarget ? Boolean(planDeletingById[deleteTarget.id]) : false;
  const plansSyncIssue = plansError && isTransientPlansSyncIssue(plansError) ? plansError : '';
  const showPlansErrorCard = Boolean(plansError) && !plansSyncIssue;
  const showPlansSyncFallback = Boolean(plansSyncIssue) && !plansLoading && plans.length === 0;

  useEffect(() => {
    if (planId && !plansLoading && plans.length > 0 && !selectedPlan) {
      navigate('/plans', { replace: true });
    }
  }, [navigate, planId, plans.length, plansLoading, selectedPlan]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPlans(listOptions);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [listOptions, loadPlans]);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('[data-plan-card]', {
          autoAlpha: 0,
          y: 18,
          scale: 0.985,
          duration: 0.46,
          stagger: 0.055,
          ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
        });

        gsap.from('[data-plan-time-block]', {
          autoAlpha: 0,
          scale: 0.86,
          duration: 0.34,
          stagger: 0.045,
          ease: 'back.out(1.7)',
          clearProps: 'transform,opacity,visibility',
          delay: 0.08,
        });
      });

      return () => mm.revert();
    },
    {
      scope: pageRef,
      dependencies: [activeFilter, filteredPlans.length, searchQuery, typeFilter],
      revertOnUpdate: true,
    },
  );

  const renderPlanCard = (plan: Plan) => {
    const { dateText, timeText } = getPlanDisplayTimeParts(plan);
    const ReminderIcon = plan.reminder ? Bell : BellOff;
    const completing = Boolean(planCompletingById[plan.id]);
    const deleting = Boolean(planDeletingById[plan.id]);
    const busy = completing || deleting || Boolean(planUpdatingById[plan.id]);

    return (
      <Card
        key={plan.id}
        className={cn(
          'relative overflow-hidden border-border/80 transition-all duration-300 hover:border-foreground/20',
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          plan.completed && 'opacity-70',
          completing && 'border-life-trace/40 shadow-[0_18px_60px_rgba(16,185,129,0.12)]',
          deleting && 'border-life-alert/40 shadow-[0_18px_60px_rgba(249,115,22,0.12)]',
        )}
        role="button"
        tabIndex={0}
        data-plan-card
        onClick={() => navigate(`/plans/${plan.id}`)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate(`/plans/${plan.id}`);
          }
        }}
      >
        {busy ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/2 z-0 w-1/2 animate-[life-shimmer_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-foreground/10 to-transparent motion-reduce:animate-none"
          />
        ) : null}
        {plan.imageUrl ? (
          <img
            src={plan.imageUrl}
            alt={plan.title}
            className="h-32 w-full object-cover opacity-80"
          />
        ) : null}
        <div className="relative z-10 grid grid-cols-[4.75rem_1fr] gap-4 p-4 max-[360px]:grid-cols-1 max-[360px]:gap-3 max-[360px]:p-3">
          <div
            className={cn(
              'flex h-20 flex-col items-center justify-center rounded-2xl border text-center max-[360px]:h-auto max-[360px]:min-h-14 max-[360px]:flex-row max-[360px]:gap-2',
              plan.reminder
                ? 'border-life-health/30 bg-life-health/10 text-life-health'
                : 'border-border bg-secondary text-muted-foreground',
            )}
            data-plan-time-block
          >
            <span className="text-xs font-semibold">{dateText}</span>
            <span className="mt-1 text-xl font-bold tracking-tight max-[360px]:mt-0">
              {timeText}
            </span>
          </div>
          <div className="min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={typeTone[plan.type]}>{plan.type}</Badge>
                  {isAdvicePlan(plan) ? <Badge tone="ai">今日建议</Badge> : null}
                  {isOverduePlan(plan) ? <Badge tone="alert">已逾期</Badge> : null}
                  {plan.completed ? <Badge tone="trace">已完成</Badge> : null}
                </div>
                <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-snug">
                  {plan.title}
                </h2>
              </div>
              <div
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
                  plan.reminder
                    ? 'bg-life-health/10 text-life-health'
                    : 'bg-secondary text-muted-foreground',
                )}
              >
                <ReminderIcon className="size-3.5" />
                {plan.reminder ? '提醒' : '未开'}
              </div>
            </div>
            <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">
              {getVisiblePlanNote(plan.note)}
            </p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">点开查看详情和更多操作</p>
              <Button
                type="button"
                variant={plan.completed ? 'secondary' : 'outline'}
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  void completePlan(plan.id);
                }}
                disabled={busy}
              >
                {completing ? (
                  <ActionLoadingIcon tone="trace" />
                ) : plan.completed ? (
                  <RotateCcw className="size-4" />
                ) : (
                  <Check className="size-4" />
                )}
                {completing ? '更新中' : plan.completed ? '取消完成' : '完成'}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div ref={pageRef} className="min-w-0 space-y-5 overflow-x-hidden">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">计划</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {todayPlans.length} 个今日计划
            {overdueCount > 0 ? ` · ${overdueCount} 个逾期` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            aria-label={searchOpen ? '关闭搜索' : '搜索计划'}
            onClick={() => setSearchOpen((current) => !current)}
          >
            {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
          </Button>
          <Button
            type="button"
            variant={filterOpen ? 'ai' : 'secondary'}
            size="icon"
            aria-label={filterOpen ? '关闭筛选' : '筛选计划'}
            onClick={() => setFilterOpen((current) => !current)}
          >
            <Filter className="size-5" />
          </Button>
          <Button
            type="button"
            variant="ai"
            size="icon"
            aria-label="创建计划"
            disabled={planCreating}
            onClick={() => {
              setEditingPlan(null);
              setDrawerOpen(true);
            }}
          >
            {planCreating ? <ActionLoadingIcon /> : <Plus className="size-5" />}
          </Button>
        </div>
      </div>

      {overdueCount > 0 && activeFilter !== 'completed' ? (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-2xl border border-life-alert/30 bg-life-alert/10 px-4 py-3 text-left text-life-alert"
          onClick={() => setActiveFilter('today')}
        >
          <span className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span className="text-sm font-semibold">有 {overdueCount} 个计划已经过期</span>
          </span>
          <span className="text-xs font-semibold">处理</span>
        </button>
      ) : null}

      <div className="grid grid-cols-3 rounded-2xl bg-card p-1 text-sm font-semibold text-muted-foreground">
        {primaryPlanFilters.map((filter) => {
          const active = activeFilter === filter.id;

          return (
            <button
              type="button"
              key={filter.id}
              className={`min-h-11 rounded-xl px-1 py-3 transition ${
                active ? 'bg-secondary text-foreground shadow-sm' : 'hover:text-foreground'
              }`}
              onClick={() => setActiveFilter(filter.id)}
              aria-pressed={active}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {searchOpen ? (
        <Card className="p-3">
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-secondary px-3 text-sm">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索标题、备注、地点"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
        </Card>
      ) : null}

      {filterOpen ? (
        <Card className="space-y-4 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">筛选</p>
              <p className="mt-1 text-xs text-muted-foreground">适合计划变多时快速收窄列表</p>
            </div>
            {(typeFilter !== 'all' || quickFilter !== 'all') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTypeFilter('all');
                  setQuickFilter('all');
                }}
              >
                清空
              </Button>
            )}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {quickFilterOptions.map((filter) => {
              const active = quickFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  className={cn(
                    'h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition',
                    active
                      ? 'border-life-health/40 bg-life-health/10 text-life-health'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setQuickFilter(filter.id)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground">
              类型
            </div>
            {planTypeOptions.map((type) => {
              const active = typeFilter === type;
              return (
                <button
                  key={type}
                  type="button"
                  className={cn(
                    'h-9 shrink-0 rounded-full border px-3 text-xs font-semibold transition',
                    active
                      ? 'border-life-ai/40 bg-life-ai/10 text-life-ai'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setTypeFilter(type)}
                >
                  {type === 'all' ? '全部类型' : type}
                </button>
              );
            })}
          </div>
        </Card>
      ) : null}

      {plansSyncIssue && !showPlansSyncFallback ? (
        <Card className="border-border/70 bg-secondary/40 p-4 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-secondary text-muted-foreground">
              <RotateCcw className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground">计划列表刚刚没有同步成功</p>
              <p className="mt-1 leading-6">{plansSyncIssue}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {showPlansErrorCard ? (
        <Card className="border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {plansError}
        </Card>
      ) : null}

      {plansLoading ? (
        <SyncState title="正在同步你的计划" description="正在从云端刷新计划列表。" tone="plan" />
      ) : null}

      <div className="space-y-6">
        {planGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className={cn('text-lg font-semibold', group.tone)}>{group.title}</h2>
              <span className="text-xs text-muted-foreground">{group.plans.length} 个</span>
            </div>
            <div className="space-y-4">{group.plans.map(renderPlanCard)}</div>
          </section>
        ))}
        {showPlansSyncFallback ? (
          <EmptyState
            title="计划刚刚没有同步下来"
            description="这次没有顺利从云端拉到计划，稍后再试就好。"
            eyebrow="同步中断"
            icon={RotateCcw}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadPlans(listOptions)}
              >
                重新加载
              </Button>
            }
          />
        ) : null}
        {!plansLoading && planGroups.length === 0 && !showPlansSyncFallback ? (
          <EmptyState
            title={activeFilter === 'all' ? '还没有计划' : '暂无匹配计划'}
            description={activeFilterConfig.emptyText}
            eyebrow={activeFilterConfig.label}
            icon={Plus}
            tone="plan"
            action={
              activeFilter !== 'all' && plans.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveFilter('today')}
                >
                  查看今日计划
                </Button>
              ) : null
            }
          />
        ) : null}
        {plansPagination.hasMore ? (
          <div className="flex justify-center pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={plansLoadingMore}
              onClick={() => void loadMorePlans()}
            >
              {plansLoadingMore ? <ActionLoadingIcon /> : null}
              {plansLoadingMore ? '加载中' : `加载更多 · ${plans.length}/${plansPagination.total}`}
            </Button>
          </div>
        ) : plans.length > 0 ? (
          <p className="text-center text-xs text-muted-foreground">已展示 {plans.length} 个计划</p>
        ) : null}
      </div>

      {!drawerOpen && plans.length > 0
        ? createPortal(
            <Button
              type="button"
              variant="ai"
              size="icon"
              className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] right-[max(1rem,calc((100vw-430px)/2+1rem))] z-40 size-14 rounded-2xl shadow-2xl"
              disabled={planCreating}
              aria-label="创建计划"
              onClick={() => {
                setEditingPlan(null);
                setDrawerOpen(true);
              }}
            >
              {planCreating ? <ActionLoadingIcon /> : <Plus className="size-6" />}
            </Button>,
            document.body,
          )
        : null}

      <CreatePlanDrawer
        open={drawerOpen}
        plan={editingPlan}
        onOpenChange={(nextOpen) => {
          setDrawerOpen(nextOpen);
          if (!nextOpen) {
            setEditingPlan(null);
          }
        }}
      />
      <PlanDetailDrawer
        open={Boolean(selectedPlan)}
        plan={selectedPlan}
        completing={selectedPlan ? Boolean(planCompletingById[selectedPlan.id]) : false}
        deleting={selectedPlan ? Boolean(planDeletingById[selectedPlan.id]) : false}
        onClose={() => navigate('/plans')}
        onComplete={(plan) => void completePlan(plan.id)}
        onEdit={(plan) => {
          navigate('/plans');
          setEditingPlan(plan);
          setDrawerOpen(true);
        }}
        onDelete={(plan) => {
          navigate('/plans');
          setDeleteTarget(plan);
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="删除这个计划？"
        description={
          deleteTarget
            ? `「${deleteTarget.title}」删除后不会再出现在今日计划里，已生成的踪迹不会被删除。`
            : ''
        }
        confirmLabel="确认删除"
        loading={deletePending}
        onCancel={() => {
          if (!deletePending) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={() => {
          if (!deleteTarget) {
            return;
          }
          void removePlan(deleteTarget.id).then(() => setDeleteTarget(null));
        }}
      />
    </div>
  );
}
