import { describe, expect, it } from 'vitest';
import type { ClosetItemCareStats } from '@/api/closet';
import {
  buildClosetCareLabel,
  buildClosetCarePayload,
  isClosetItemCareDue,
} from '@/lib/closetCare';

describe('closetCare', () => {
  it('identifies due care items and formats label', () => {
    const stats: ClosetItemCareStats = {
      wornCountSinceCare: 4,
      careStatus: 'overdue',
      overdueWears: 2,
      dueInWears: 0,
    };

    expect(isClosetItemCareDue(stats)).toBe(true);
    expect(buildClosetCareLabel(stats)).toBe('已超 2 次');
  });

  it('builds mark-care payload with today date', () => {
    expect(buildClosetCarePayload('2026-06-15')).toEqual({ lastCareDate: '2026-06-15' });
  });
});
