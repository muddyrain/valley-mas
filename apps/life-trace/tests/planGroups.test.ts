import { describe, expect, it, vi } from 'vitest';
import { filterPlans, splitPlansByToday } from '../src/lib/planGroups';
import type { Plan } from '../src/types';

const createPlan = (
  id: string,
  timeLabel: string,
  reminder = true,
  fields: Partial<Pick<Plan, 'scheduledDate' | 'scheduledTime'>> = {},
): Plan => ({
  id,
  title: id,
  type: '普通事项',
  timeLabel,
  reminder,
  note: '',
  completed: false,
  ...fields,
});

describe('splitPlansByToday', () => {
  it('keeps today plans before other plans', () => {
    const groups = splitPlansByToday([
      createPlan('weekend', '周六 19:30'),
      createPlan('today-evening', '今天 晚上'),
      createPlan('tomorrow', '明天 07:30'),
      createPlan('today-commute', '今天 上班前'),
    ]);

    expect(groups.todayPlans.map((plan) => plan.id)).toEqual(['today-evening', 'today-commute']);
    expect(groups.otherPlans.map((plan) => plan.id)).toEqual(['weekend', 'tomorrow']);
  });
});

describe('filterPlans', () => {
  const plans = [
    createPlan('today', '今天 晚上', false),
    createPlan('saturday', '周六 19:30', true),
    createPlan('sunday', '星期日 下午', false),
    createPlan('tomorrow', '明天 07:30', true),
  ];

  it('filters plans by today label', () => {
    expect(filterPlans(plans, 'today').map((plan) => plan.id)).toEqual(['today']);
  });

  it('filters plans by weekend label', () => {
    expect(filterPlans(plans, 'weekend').map((plan) => plan.id)).toEqual(['saturday', 'sunday']);
  });

  it('filters plans with reminders', () => {
    expect(filterPlans(plans, 'reminded').map((plan) => plan.id)).toEqual(['saturday', 'tomorrow']);
  });

  it('prefers structured date fields when filtering today and weekend', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 27, 9, 0, 0));

    try {
      const scheduledPlans = [
        createPlan('today', '下周某天', true, {
          scheduledDate: '2026-05-27',
          scheduledTime: '10:00',
        }),
        createPlan('weekend', '普通安排', true, {
          scheduledDate: '2026-05-30',
          scheduledTime: '20:00',
        }),
      ];

      expect(filterPlans(scheduledPlans, 'today').map((plan) => plan.id)).toEqual(['today']);
      expect(filterPlans(scheduledPlans, 'weekend').map((plan) => plan.id)).toEqual(['weekend']);
    } finally {
      vi.useRealTimers();
    }
  });
});
