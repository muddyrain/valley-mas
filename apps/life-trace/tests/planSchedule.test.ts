import { describe, expect, it } from 'vitest';
import {
  buildPlanSchedule,
  buildScheduledDateTime,
  buildTodaySchedule,
  isPlanScheduledToday,
  isPlanScheduledWeekend,
  resolveScheduledDate,
} from '../src/lib/planSchedule';
import type { Plan } from '../src/types';

const createPlan = (id: string, timeLabel: string, fields: Partial<Plan> = {}): Plan => ({
  id,
  title: id,
  type: '普通事项',
  timeLabel,
  reminder: true,
  note: '',
  completed: false,
  ...fields,
});

describe('planSchedule', () => {
  const now = new Date(2026, 4, 27, 10, 0, 0);

  it('builds structured fields from drawer date and time', () => {
    const schedule = buildPlanSchedule({ dateOption: '明天', time: '08:15', now });

    expect(schedule).toMatchObject({
      timeLabel: '明天 08:15',
      scheduledDate: '2026-05-28',
      scheduledTime: '08:15',
    });
    expect(schedule.timezone).not.toBe('');
  });

  it('resolves weekday and custom dates', () => {
    expect(resolveScheduledDate('周六', '', now)).toBe('2026-05-30');
    expect(resolveScheduledDate('custom', '2026-06-03', now)).toBe('2026-06-03');
  });

  it('keeps fuzzy advice copy while adding concrete reminder fields', () => {
    expect(buildTodaySchedule({ timeLabel: '今天 上班前', scheduledTime: '08:30', now })).toEqual(
      expect.objectContaining({
        timeLabel: '今天 上班前',
        scheduledDate: '2026-05-27',
        scheduledTime: '08:30',
      }),
    );
  });

  it('uses structured fields for filtering helpers', () => {
    const today = createPlan('today', '2026-05-27 10:00', {
      scheduledDate: '2026-05-27',
      scheduledTime: '10:00',
    });
    const weekend = createPlan('weekend', '周末', {
      scheduledDate: '2026-05-30',
      scheduledTime: '20:00',
    });

    expect(isPlanScheduledToday(today, now)).toBe(true);
    expect(isPlanScheduledWeekend(weekend)).toBe(true);
  });

  it('builds a local date from structured fields', () => {
    expect(buildScheduledDateTime('2026-06-01', '09:05')?.toISOString()).toBe(
      new Date(2026, 5, 1, 9, 5, 0).toISOString(),
    );
  });
});
