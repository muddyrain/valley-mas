import type { Plan } from '@/types';
import {
  getLocalISODate,
  getPlanScheduledDateTime,
  isPlanScheduledToday,
  isPlanScheduledWeekend,
} from './planSchedule';

export type PlanFilter =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'overdue'
  | 'weekend'
  | 'reminded'
  | 'completed';

type TodayPlanGroups = {
  todayPlans: Plan[];
  otherPlans: Plan[];
};

export type PlanTimelineGroups = {
  overduePlans: Plan[];
  todayPlans: Plan[];
  upcomingPlans: Plan[];
  unscheduledPlans: Plan[];
  completedPlans: Plan[];
};

export function splitPlansByToday(plans: Plan[]): TodayPlanGroups {
  return plans.reduce<TodayPlanGroups>(
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
  return isPlanScheduledToday(plan);
}

export function isWeekendPlan(plan: Plan) {
  return isPlanScheduledWeekend(plan);
}

export function isOverduePlan(plan: Plan, now = new Date()) {
  if (plan.completed) {
    return false;
  }
  const scheduledAt = getPlanScheduledDateTime(plan);
  return Boolean(scheduledAt && scheduledAt.getTime() < now.getTime());
}

export function isUpcomingPlan(plan: Plan, now = new Date()) {
  if (plan.completed || !plan.scheduledDate) {
    return false;
  }
  return plan.scheduledDate > getLocalISODate(now);
}

export function filterPlans(plans: Plan[], filter: PlanFilter) {
  if (filter === 'today') {
    return plans.filter(isTodayPlan);
  }

  if (filter === 'weekend') {
    return plans.filter(isWeekendPlan);
  }

  if (filter === 'upcoming') {
    return plans.filter((plan) => isUpcomingPlan(plan));
  }

  if (filter === 'overdue') {
    return plans.filter((plan) => isOverduePlan(plan));
  }

  if (filter === 'reminded') {
    return plans.filter((plan) => plan.reminder);
  }

  if (filter === 'completed') {
    return plans.filter((plan) => plan.completed);
  }

  return plans;
}

export function filterPlansByKeywordAndType(
  plans: Plan[],
  keyword: string,
  planType: Plan['type'] | 'all',
) {
  const normalizedKeyword = keyword.trim().toLocaleLowerCase('zh-CN');
  return plans.filter((plan) => {
    if (planType !== 'all' && plan.type !== planType) {
      return false;
    }
    if (!normalizedKeyword) {
      return true;
    }
    return [plan.title, plan.note, plan.location ?? ''].some((value) =>
      value.toLocaleLowerCase('zh-CN').includes(normalizedKeyword),
    );
  });
}

export function splitPlansByTimeline(plans: Plan[], now = new Date()) {
  const today = getLocalISODate(now);
  return plans.reduce<PlanTimelineGroups>(
    (groups, plan) => {
      if (plan.completed) {
        groups.completedPlans.push(plan);
      } else if (isOverduePlan(plan, now)) {
        groups.overduePlans.push(plan);
      } else if (plan.scheduledDate === today || isTodayPlan(plan)) {
        groups.todayPlans.push(plan);
      } else if (plan.scheduledDate) {
        groups.upcomingPlans.push(plan);
      } else {
        groups.unscheduledPlans.push(plan);
      }
      return groups;
    },
    {
      overduePlans: [],
      todayPlans: [],
      upcomingPlans: [],
      unscheduledPlans: [],
      completedPlans: [],
    },
  );
}

export function isAdvicePlan(plan: Plan) {
  return (
    plan.source === 'weather_advice' ||
    plan.source === 'ai_advice' ||
    plan.note.includes('来自今日建议')
  );
}
