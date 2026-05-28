import { getClientTimezone, getLocalISODate } from '@/lib/planSchedule';
import type { NewPlanInput } from '@/types';

type WeeklyReviewActionPlanInput = {
  reviewId: string;
  action: string;
  actionIndex: number;
  now?: Date;
};

const DEFAULT_ACTION_TIME = '20:00';

export function buildWeeklyReviewActionMarker(reviewId: string, actionIndex: number) {
  return `#weekly-review-action:${reviewId}-${actionIndex}`;
}

export function createPlanFromWeeklyReviewAction({
  reviewId,
  action,
  actionIndex,
  now = new Date(),
}: WeeklyReviewActionPlanInput): NewPlanInput {
  const title = action.trim() || '下周行动';
  const scheduledDate = getNextMondayISODate(now);

  return {
    title,
    type: '普通事项',
    timeLabel: `下周一 ${DEFAULT_ACTION_TIME}`,
    scheduledDate,
    scheduledTime: DEFAULT_ACTION_TIME,
    timezone: getClientTimezone(),
    reminder: true,
    source: 'ai_advice',
    note: `来自每周回顾的下周行动。${buildWeeklyReviewActionMarker(reviewId, actionIndex)}`,
  };
}

export function hasWeeklyReviewActionPlan(
  plans: Array<{ note: string }>,
  reviewId: string,
  actionIndex: number,
) {
  const marker = buildWeeklyReviewActionMarker(reviewId, actionIndex);
  return plans.some((plan) => plan.note.includes(marker));
}

function getNextMondayISODate(now: Date) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const daysUntilNextMonday = (1 - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + daysUntilNextMonday);
  return getLocalISODate(date);
}
