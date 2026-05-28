import type { WeeklyReviewResponse } from '@/api/advice';

export function getCurrentWeekStart(now = new Date()) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  const daysFromMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return formatLocalDate(date);
}

export function findCurrentWeekReview(reviews: WeeklyReviewResponse[], now = new Date()) {
  const weekStart = getCurrentWeekStart(now);
  return reviews.find((review) => review.weekStart === weekStart) ?? null;
}

export function toggleExpandedWeeklyReviewId(currentId: string | null, targetId: string) {
  return currentId === targetId ? null : targetId;
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
