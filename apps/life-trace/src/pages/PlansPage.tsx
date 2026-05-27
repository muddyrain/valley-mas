import { Bell, Check, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { filterPlans, isAdvicePlan, type PlanFilter, splitPlansByToday } from '@/lib/planGroups';
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

  const renderPlanCard = (plan: Plan) => (
    <Card key={plan.id} className="overflow-hidden">
      {plan.imageUrl ? (
        <img src={plan.imageUrl} alt={plan.title} className="h-32 w-full object-cover opacity-80" />
      ) : null}
      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Badge tone={typeTone[plan.type]}>{plan.type}</Badge>
            {isAdvicePlan(plan) ? <Badge tone="ai">今日建议</Badge> : null}
          </div>
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
            <Bell className="size-4 text-life-health" />
            {plan.reminder ? '已设提醒' : '未提醒'}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-snug">{plan.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{plan.timeLabel}</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="line-clamp-1 text-sm text-muted-foreground">{plan.note}</p>
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
    </Card>
  );

  return (
    <div className="space-y-5">
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
