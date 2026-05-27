import { Bell, Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isAdvicePlan, splitPlansByToday } from '@/lib/planGroups';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { Plan, PlanType } from '@/types';

const typeTone: Record<PlanType, 'plan' | 'health' | 'trace' | 'weather' | 'ai' | 'alert'> = {
  电影: 'plan',
  吃饭: 'health',
  运动: 'trace',
  阅读: 'weather',
  聚会: 'ai',
  普通事项: 'alert',
};

export function PlansPage() {
  const { plans, completePlan } = useLifeTraceStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { todayPlans, otherPlans } = splitPlansByToday(plans);
  const planGroups = [
    { title: '今日计划', plans: todayPlans },
    { title: '其他计划', plans: otherPlans },
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
            onClick={() => completePlan(plan.id)}
            disabled={plan.completed}
          >
            <Check className="size-4" />
            {plan.completed ? '已完成' : '完成'}
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="计划" meta={`${todayPlans.length} 个今日计划`} />

      <div className="grid grid-cols-4 rounded-2xl bg-card p-1 text-sm font-semibold text-muted-foreground">
        {['全部', '今天', '周末', '已提醒'].map((filter, index) => (
          <button
            type="button"
            key={filter}
            className={`rounded-xl py-3 transition ${index === 0 ? 'bg-secondary text-foreground' : 'hover:text-foreground'}`}
          >
            {filter}
          </button>
        ))}
      </div>

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
      </div>

      <Button
        type="button"
        variant="ai"
        className="fixed bottom-28 left-1/2 z-10 -translate-x-1/2 px-6"
        onClick={() => setDrawerOpen(true)}
      >
        <Plus className="size-5" />
        创建计划
      </Button>

      <CreatePlanDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
