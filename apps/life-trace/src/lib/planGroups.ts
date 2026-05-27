import type { Plan } from '@/types';

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

export function isAdvicePlan(plan: Plan) {
  return plan.note.includes('来自今日建议');
}
