import { describe, expect, it } from 'vitest';
import {
  getDueReminder,
  getNextReminder,
  parsePlanReminderDate,
  splitPlanTimeLabel,
} from '../src/lib/planReminder';
import type { Plan } from '../src/types';

const createPlan = (
  id: string,
  timeLabel: string,
  options: Partial<Pick<Plan, 'reminder' | 'completed'>> = {},
): Plan => ({
  id,
  title: id,
  type: '普通事项',
  timeLabel,
  reminder: options.reminder ?? true,
  note: '',
  completed: options.completed ?? false,
});

describe('parsePlanReminderDate', () => {
  const now = new Date(2026, 4, 27, 10, 0, 0);

  it('parses today and tomorrow time labels', () => {
    expect(parsePlanReminderDate(createPlan('today', '今天 19:30'), now)?.toISOString()).toBe(
      new Date(2026, 4, 27, 19, 30, 0).toISOString(),
    );
    expect(parsePlanReminderDate(createPlan('tomorrow', '明天 08:15'), now)?.toISOString()).toBe(
      new Date(2026, 4, 28, 8, 15, 0).toISOString(),
    );
  });

  it('parses weekend and custom date labels', () => {
    expect(parsePlanReminderDate(createPlan('saturday', '周六 20:00'), now)?.toISOString()).toBe(
      new Date(2026, 4, 30, 20, 0, 0).toISOString(),
    );
    expect(
      parsePlanReminderDate(createPlan('custom', '2026-06-01 09:00'), now)?.toISOString(),
    ).toBe(new Date(2026, 5, 1, 9, 0, 0).toISOString());
  });

  it('ignores fuzzy labels without concrete time', () => {
    expect(parsePlanReminderDate(createPlan('fuzzy', '今天 晚上'), now)).toBeNull();
  });
});

describe('splitPlanTimeLabel', () => {
  it('splits date and time for card display', () => {
    expect(splitPlanTimeLabel('今天 19:30')).toEqual({
      dateText: '今天',
      timeText: '19:30',
    });
  });

  it('keeps a fallback for fuzzy labels', () => {
    expect(splitPlanTimeLabel('今天 晚上')).toEqual({
      dateText: '今天',
      timeText: '晚上',
    });
  });
});

describe('getNextReminder', () => {
  const now = new Date(2026, 4, 27, 10, 0, 0);

  it('returns the nearest future active reminder', () => {
    const next = getNextReminder(
      [
        createPlan('disabled', '今天 10:20', { reminder: false }),
        createPlan('completed', '今天 10:10', { completed: true }),
        createPlan('later', '今天 12:00'),
        createPlan('next', '今天 10:30'),
      ],
      now,
    );

    expect(next?.plan.id).toBe('next');
    expect(next?.timeText).toBe('10:30');
    expect(next?.relativeText).toBe('30 分钟后');
  });

  it('returns null when no future reminder can be parsed', () => {
    expect(getNextReminder([createPlan('past', '今天 09:30')], now)).toBeNull();
  });
});

describe('getDueReminder', () => {
  const now = new Date(2026, 4, 27, 10, 30, 0);

  it('returns the latest due reminder inside the lookback window', () => {
    const due = getDueReminder(
      [
        createPlan('old', '今天 08:00'),
        createPlan('latest', '今天 10:20'),
        createPlan('future', '今天 11:00'),
      ],
      now,
    );

    expect(due?.plan.id).toBe('latest');
    expect(due?.timeText).toBe('10:20');
  });

  it('ignores completed, dismissed, snoozed, and stale reminders', () => {
    const due = getDueReminder(
      [
        createPlan('completed', '今天 10:00', { completed: true }),
        createPlan('dismissed', '今天 10:05'),
        createPlan('snoozed', '今天 10:10'),
        createPlan('stale', '昨天 10:10'),
        createPlan('valid', '今天 10:15'),
      ],
      now,
      {
        ignoredPlanIds: ['dismissed'],
        snoozedUntilByPlanId: {
          snoozed: new Date(2026, 4, 27, 10, 40, 0).getTime(),
        },
      },
    );

    expect(due?.plan.id).toBe('valid');
  });
});
