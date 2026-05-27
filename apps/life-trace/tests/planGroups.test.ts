import { describe, expect, it } from 'vitest';
import { filterPlans, splitPlansByToday } from '../src/lib/planGroups';
import type { Plan } from '../src/types';

const createPlan = (id: string, timeLabel: string, reminder = true): Plan => ({
  id,
  title: id,
  type: '普通事项',
  timeLabel,
  reminder,
  note: '',
  completed: false,
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
});
