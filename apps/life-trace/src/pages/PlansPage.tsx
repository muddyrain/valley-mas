import { Bell, BellOff, Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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
import { filterPlans, isAdvicePlan, type PlanFilter, splitPlansByToday } from '@/lib/planGroups';
import { getPlanDisplayTimeParts } from '@/lib/planReminder';
import { cn } from '@/lib/utils';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Plan, PlanType } from '@/types';

const planFilters: Array<{ id: PlanFilter; label: string; emptyText: string }> = [
  {
    id: 'all',
    label: '全部',
    emptyText: '还没有计划。先创建一个今日计划，Life Trace 会帮你持续记录。',
  },
  {
    id: 'today',
    label: '今天',
    emptyText: '今天还没有计划。可以先添加一个喝水、通勤或下班后的安排。',
  },
  {
    id: 'weekend',
    label: '周末',
    emptyText: '周末还没有安排。可以先计划一部电影、一顿饭或一次放松活动。',
  },
  {
    id: 'reminded',
    label: '已提醒',
    emptyText: '还没有设置提醒的计划。创建计划时打开提醒，就会出现在这里。',
  },
];

const typeTone: Record<PlanType, 'plan' | 'health' | 'trace' | 'weather' | 'ai' | 'alert'> = {
  电影: 'plan',
  吃饭: 'health',
  运动: 'trace',
  阅读: 'weather',
  聚会: 'ai',
  普通事项: 'alert',
};

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
    loadMorePlans,
    removePlan,
  } = useLifeTraceStore();
  const navigate = useNavigate();
  const { planId } = useParams<{ planId?: string }>();
  const pageRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [activeFilter, setActiveFilter] = useState<PlanFilter>('all');
  const [showCompletedInAll, setShowCompletedInAll] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const filteredPlans = filterPlans(plans, activeFilter).filter(
    (plan) => activeFilter !== 'all' || showCompletedInAll || !plan.completed,
  );
  const { todayPlans } = splitPlansByToday(plans);
  const hiddenCompletedCount =
    activeFilter === 'all' && !showCompletedInAll
      ? plans.filter((plan) => plan.completed).length
      : 0;
  const filteredGroups = splitPlansByToday(filteredPlans);
  const activeFilterConfig =
    planFilters.find((filter) => filter.id === activeFilter) ?? planFilters[0];
  const planGroups = [
    { title: '今日计划', plans: filteredGroups.todayPlans },
    { title: '其他计划', plans: filteredGroups.otherPlans },
  ].filter((group) => group.plans.length > 0);
  const selectedPlan = planId ? (plans.find((plan) => plan.id === planId) ?? null) : null;
  const deletePending = deleteTarget ? Boolean(planDeletingById[deleteTarget.id]) : false;

  useEffect(() => {
    if (planId && !plansLoading && plans.length > 0 && !selectedPlan) {
      navigate('/plans', { replace: true });
    }
  }, [navigate, planId, plans.length, plansLoading, selectedPlan]);

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
    { scope: pageRef, dependencies: [activeFilter, filteredPlans.length], revertOnUpdate: true },
  );

  const renderPlanCard = (plan: Plan) => {
    const { dateText, timeText } = getPlanDisplayTimeParts(plan);
    const ReminderIcon = plan.reminder ? Bell : BellOff;
    const updating = Boolean(planUpdatingById[plan.id]);
    const completing = Boolean(planCompletingById[plan.id]);
    const deleting = Boolean(planDeletingById[plan.id]);
    const busy = updating || completing || deleting;

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
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              {!plan.completed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="px-3 text-muted-foreground"
                  aria-label={`编辑${plan.title}`}
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    setEditingPlan(plan);
                    setDrawerOpen(true);
                  }}
                >
                  {updating ? <ActionLoadingIcon /> : <Pencil className="size-4" />}
                  {updating ? '保存中' : null}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-3 text-muted-foreground"
                aria-label={`删除${plan.title}`}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  setDeleteTarget(plan);
                }}
              >
                {deleting ? <ActionLoadingIcon tone="alert" /> : <Trash2 className="size-4" />}
                {deleting ? '删除中' : null}
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
          <p className="mt-1 text-sm text-muted-foreground">{todayPlans.length} 个今日计划</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showCompletedInAll}
          className={cn(
            'flex shrink-0 cursor-pointer items-center gap-2 rounded-full border px-2 py-1.5 text-xs font-semibold transition',
            showCompletedInAll
              ? 'border-life-health/40 bg-life-health/10 text-life-health'
              : 'border-border bg-card text-muted-foreground',
          )}
          onClick={() => setShowCompletedInAll((current) => !current)}
        >
          <span
            className={cn(
              'relative h-5 w-9 rounded-full transition',
              showCompletedInAll ? 'bg-life-health/80' : 'bg-secondary',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition',
                showCompletedInAll ? 'left-4' : 'left-0.5',
              )}
            />
          </span>
          显示完成
        </button>
      </div>

      <div className="grid grid-cols-4 rounded-2xl bg-card p-1 text-sm font-semibold text-muted-foreground max-[360px]:text-xs">
        {planFilters.map((filter) => {
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

      {plansError ? (
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
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <span className="text-xs text-muted-foreground">{group.plans.length} 个</span>
            </div>
            <div className="space-y-4">{group.plans.map(renderPlanCard)}</div>
          </section>
        ))}
        {!plansLoading && planGroups.length === 0 ? (
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
                  onClick={() => setActiveFilter('all')}
                >
                  查看全部计划
                </Button>
              ) : null
            }
          />
        ) : null}
        {hiddenCompletedCount > 0 ? (
          <p className="px-1 text-center text-xs text-muted-foreground">
            已隐藏 {hiddenCompletedCount} 个已完成计划，打开右上角开关可查看。
          </p>
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

      {!drawerOpen
        ? createPortal(
            <Button
              type="button"
              variant="ai"
              className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 px-6"
              disabled={planCreating}
              onClick={() => {
                setEditingPlan(null);
                setDrawerOpen(true);
              }}
            >
              {planCreating ? <ActionLoadingIcon /> : <Plus className="size-5" />}
              {planCreating ? '创建中' : '创建计划'}
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
