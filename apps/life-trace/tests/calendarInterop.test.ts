import { describe, expect, it } from 'vitest';
import { createPlanCalendarEvent } from '../src/lib/calendarInterop';
import type { Plan } from '../src/types';

function createPlan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: 'plan-1',
    title: '晚餐：番茄炒蛋',
    type: '吃饭',
    timeLabel: '2026-06-08 19:30',
    scheduledDate: '2026-06-08',
    scheduledTime: '19:30',
    timezone: 'Asia/Shanghai',
    reminder: true,
    location: '家里',
    note: '记得提前买鸡蛋。#advice:pantry',
    completed: false,
    ...overrides,
  };
}

describe('calendarInterop', () => {
  it('builds an iCalendar event from a scheduled plan', () => {
    const event = createPlanCalendarEvent(createPlan(), {
      now: new Date(2026, 5, 8, 10, 0, 0),
      eventUrl: 'https://life.example.com/plans/plan-1',
      reminderLeadMinutes: 15,
    });

    expect(event?.filename).toBe('晚餐：番茄炒蛋.ics');
    expect(event?.content).toContain('BEGIN:VCALENDAR\r\nVERSION:2.0');
    expect(event?.content).toContain('UID:life-trace-plan-plan-1@valley-mas');
    expect(event?.content).toContain('SUMMARY:晚餐：番茄炒蛋');
    expect(event?.content).toContain('LOCATION:家里');
    expect(event?.content).toContain('TRIGGER:-PT15M');
    expect(event?.content).toContain('URL:https://life.example.com/plans/plan-1');
    expect(event?.content).toContain('记得提前买鸡蛋。\\nLife Trace');
    expect(event?.content).not.toContain('#advice:pantry');
  });

  it('returns null when a plan has no concrete calendar time', () => {
    expect(
      createPlanCalendarEvent(
        createPlan({
          timeLabel: '今天 晚上',
          scheduledDate: '',
          scheduledTime: '',
        }),
        { now: new Date(2026, 5, 8, 10, 0, 0) },
      ),
    ).toBeNull();
  });

  it('omits alarm blocks when plan reminders are disabled', () => {
    const event = createPlanCalendarEvent(createPlan({ reminder: false }));

    expect(event?.content).not.toContain('BEGIN:VALARM');
  });
});
