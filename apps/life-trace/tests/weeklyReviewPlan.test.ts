import { describe, expect, it } from 'vitest';
import {
  buildWeeklyReviewActionMarker,
  createPlanFromWeeklyReviewAction,
  hasWeeklyReviewActionPlan,
} from '../src/lib/weeklyReviewPlan';

describe('weekly review action plans', () => {
  it('creates a next-week plan from a weekly review action', () => {
    const plan = createPlanFromWeeklyReviewAction({
      reviewId: 'review-1',
      action: '下周先安排一次阅读',
      actionIndex: 0,
      now: new Date('2026-05-28T21:30:00+08:00'),
    });

    expect(plan.title).toBe('下周先安排一次阅读');
    expect(plan.type).toBe('普通事项');
    expect(plan.timeLabel).toBe('下周一 20:00');
    expect(plan.scheduledDate).toBe('2026-06-01');
    expect(plan.scheduledTime).toBe('20:00');
    expect(plan.source).toBe('ai_advice');
    expect(plan.note).toContain('#weekly-review-action:review-1-0');
  });

  it('detects existing plans from weekly review actions', () => {
    const marker = buildWeeklyReviewActionMarker('review-1', 2);

    expect(hasWeeklyReviewActionPlan([{ note: `来自周报。${marker}` }], 'review-1', 2)).toBe(true);
    expect(hasWeeklyReviewActionPlan([{ note: `来自周报。${marker}` }], 'review-1', 1)).toBe(false);
  });
});
