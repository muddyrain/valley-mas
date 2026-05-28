import { describe, expect, it } from 'vitest';
import {
  findCurrentWeekReview,
  getCurrentWeekStart,
  toggleExpandedWeeklyReviewId,
} from '../src/lib/weeklyReviews';

describe('weekly review helpers', () => {
  it('uses Monday as the current natural week start', () => {
    const weekStart = getCurrentWeekStart(new Date('2026-05-28T21:30:00+08:00'));

    expect(weekStart).toBe('2026-05-25');
  });

  it('finds an archived review for the current natural week', () => {
    const review = findCurrentWeekReview(
      [
        {
          id: 'review-1',
          weekStart: '2026-05-25',
          weekEnd: '2026-05-28',
          summary: '本周周报',
          wins: [],
          delays: [],
          insights: [],
          nextActions: [],
          source: 'openai',
        },
      ],
      new Date('2026-05-28T21:30:00+08:00'),
    );

    expect(review?.id).toBe('review-1');
  });

  it('toggles the expanded weekly review id', () => {
    expect(toggleExpandedWeeklyReviewId(null, 'review-1')).toBe('review-1');
    expect(toggleExpandedWeeklyReviewId('review-1', 'review-1')).toBeNull();
    expect(toggleExpandedWeeklyReviewId('review-1', 'review-2')).toBe('review-2');
  });
});
