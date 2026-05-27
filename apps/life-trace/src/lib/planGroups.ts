import type { Plan } from '@/types';

export type PlanFilter = 'all' | 'today' | 'weekend' | 'reminded';

export type PlanGroups = {
  todayPlans: Plan[];
  otherPlans: Plan[];
};

export function splitPlansByToday(plans: Plan[]): PlanGroups {
  return plans.reduce<PlanGroups>(
    (groups, plan) => {
      if (isTodayPlan(plan)) {
        groups.todayPlans.push(plan);
      } else {
        groups.otherPlans.push(plan);
      }
      return groups;
    },
    { todayPlans: [], otherPlans: [] },
  );
}

export function isTodayPlan(plan: Plan) {
  return plan.timeLabel.trim().startsWith('今天');
}

export function isWeekendPlan(plan: Plan) {
  const timeLabel = plan.timeLabel.trim();
  return (
    timeLabel.startsWith('周末') ||
    timeLabel.startsWith('周六') ||
    timeLabel.startsWith('周日') ||
    timeLabel.startsWith('星期六') ||
    timeLabel.startsWith('星期日')
  );
}

export function filterPlans(plans: Plan[], filter: PlanFilter) {
  if (filter === 'today') {
    return plans.filter(isTodayPlan);
  }

  if (filter === 'weekend') {
    return plans.filter(isWeekendPlan);
  }

  if (filter === 'reminded') {
    return plans.filter((plan) => plan.reminder);
  }

  return plans;
}

export function isAdvicePlan(plan: Plan) {
  return (
    plan.source === 'weather_advice' ||
    plan.source === 'ai_advice' ||
    plan.note.includes('来自今日建议')
  );
}
