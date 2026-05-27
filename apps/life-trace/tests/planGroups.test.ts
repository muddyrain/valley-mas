import { describe, expect, it } from 'vitest';
import { splitPlansByToday } from '../src/lib/planGroups';
import type { Plan } from '../src/types';

const createPlan = (id: string, timeLabel: string): Plan => ({
  id,
  title: id,
  type: '普通事项',
  timeLabel,
  reminder: true,
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
