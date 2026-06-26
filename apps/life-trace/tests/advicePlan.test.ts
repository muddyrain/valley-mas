import { describe, expect, it } from 'vitest';
import { createPlanFromAdvice, getVisiblePlanNote } from '../src/lib/advicePlan';

describe('createPlanFromAdvice', () => {
  it('turns commute advice into a reminder-style plan', () => {
    const plan = createPlanFromAdvice({
      id: 'commute',
      title: '通勤',
      detail: '开车通勤，建议提前15分钟',
      city: '杭州',
    });

    expect(plan.title).toBe('通勤提醒：开车通勤，建议提前15分钟');
    expect(plan.type).toBe('普通事项');
    expect(plan.timeLabel).toMatch(/^\d{4}-\d{2}-\d{2} 08:30$/);
    expect(plan.scheduledTime).toBe('08:30');
    expect(plan.reminder).toBe(true);
    expect(plan.note).toContain('杭州');
    expect(plan.note).toContain('advice:commute');
  });

  it('turns health advice into a health plan', () => {
    const plan = createPlanFromAdvice({
      id: 'health',
      title: '健康',
      detail: '湿热感强，注意补水休息',
      city: '杭州',
    });

    expect(plan.title).toBe('健康提醒：湿热感强，注意补水休息');
    expect(plan.type).toBe('运动');
    expect(plan.timeLabel).toMatch(/^\d{4}-\d{2}-\d{2} 20:00$/);
    expect(plan.scheduledTime).toBe('20:00');
    expect(plan.note).toContain('advice:health');
  });

  it('hides internal advice markers from visible plan notes', () => {
    expect(getVisiblePlanNote('来自今日建议「通勤」。城市：上海。#advice:commute')).toBe(
      '来自今日建议「通勤」。城市：上海。',
    );
  });
});
