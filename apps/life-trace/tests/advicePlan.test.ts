import { describe, expect, it } from 'vitest';
import { createPlanFromAdvice } from '../src/lib/advicePlan';

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
    expect(plan.timeLabel).toBe('今天 上班前');
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

    expect(plan.title).toBe('健康打卡：湿热感强，注意补水休息');
    expect(plan.type).toBe('运动');
    expect(plan.timeLabel).toBe('今天 晚上');
    expect(plan.note).toContain('advice:health');
  });
});
