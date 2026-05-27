import { Bell, BellOff, Check, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { gsap, useGSAP } from '@/lib/gsap';
import { filterPlans, isAdvicePlan, type PlanFilter, splitPlansByToday } from '@/lib/planGroups';
import { splitPlanTimeLabel } from '@/lib/planReminder';
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
  const { plans, plansError, plansLoading, completePlan, removePlan } = useLifeTraceStore();
  const pageRef = useRef<HTMLDivElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<PlanFilter>('all');
  const filteredPlans = filterPlans(plans, activeFilter);
  const { todayPlans } = splitPlansByToday(plans);
  const filteredGroups = splitPlansByToday(filteredPlans);
  const activeFilterConfig =
    planFilters.find((filter) => filter.id === activeFilter) ?? planFilters[0];
  const planGroups = [
    { title: '今日计划', plans: filteredGroups.todayPlans },
    { title: '其他计划', plans: filteredGroups.otherPlans },
  ].filter((group) => group.plans.length > 0);

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
    const { dateText, timeText } = splitPlanTimeLabel(plan.timeLabel);
    const ReminderIcon = plan.reminder ? Bell : BellOff;

    return (
      <Card
        key={plan.id}
        className={cn(
          'overflow-hidden border-border/80 transition-colors hover:border-foreground/20',
          plan.completed && 'opacity-70',
        )}
        data-plan-card
      >
        {plan.imageUrl ? (
          <img
            src={plan.imageUrl}
            alt={plan.title}
            className="h-32 w-full object-cover opacity-80"
          />
        ) : null}
        <div className="grid grid-cols-[4.75rem_1fr] gap-4 p-4">
          <div
            className={cn(
              'flex h-20 flex-col items-center justify-center rounded-2xl border text-center',
              plan.reminder
                ? 'border-life-health/30 bg-life-health/10 text-life-health'
                : 'border-border bg-secondary text-muted-foreground',
            )}
            data-plan-time-block
          >
            <span className="text-xs font-semibold">{dateText}</span>
            <span className="mt-1 text-xl font-bold tracking-tight">{timeText}</span>
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
            <p className="line-clamp-2 text-sm leading-5 text-muted-foreground">{plan.note}</p>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant={plan.completed ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => void completePlan(plan.id)}
                disabled={plan.completed}
              >
                <Check className="size-4" />
                {plan.completed ? '已完成' : '完成'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-3 text-muted-foreground"
                aria-label={`删除${plan.title}`}
                onClick={() => void removePlan(plan.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div ref={pageRef} className="space-y-5">
      <SectionHeader title="计划" meta={`${todayPlans.length} 个今日计划`} />

      <div className="grid grid-cols-4 rounded-2xl bg-card p-1 text-sm font-semibold text-muted-foreground">
        {planFilters.map((filter) => {
          const active = activeFilter === filter.id;

          return (
            <button
              type="button"
              key={filter.id}
              className={`rounded-xl py-3 transition ${
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
        <Card className="p-5 text-sm text-muted-foreground">正在同步你的计划...</Card>
      ) : null}

      <div className="space-y-6">
        {planGroups.map((group) => (
          <section key={group.title} className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{group.title}</h2>
              <span className="text-xs text-muted-foreground">{group.plans.length} 个</span>
            </div>
            <div className="space-y-4">{group.plans.map(renderPlanCard)}</div>
          </section>
        ))}
        {!plansLoading && planGroups.length === 0 ? (
          <Card className="space-y-2 p-5 text-sm text-muted-foreground">
            <p>{activeFilterConfig.emptyText}</p>
            {activeFilter !== 'all' && plans.length > 0 ? (
              <button
                type="button"
                className="cursor-pointer text-life-ai transition hover:text-life-ai/80"
                onClick={() => setActiveFilter('all')}
              >
                查看全部计划
              </button>
            ) : null}
          </Card>
        ) : null}
      </div>

      {!drawerOpen
        ? createPortal(
            <Button
              type="button"
              variant="ai"
              className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 px-6"
              onClick={() => setDrawerOpen(true)}
            >
              <Plus className="size-5" />
              创建计划
            </Button>,
            document.body,
          )
        : null}

      <CreatePlanDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
