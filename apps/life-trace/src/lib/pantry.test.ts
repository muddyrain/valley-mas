import { describe, expect, it } from 'vitest';
import type { PantryItem } from '@/types';
import { getPantryExpiryText } from './pantry';

function pantryItem(expiresAt: string): PantryItem {
  return {
    id: '1',
    name: '海盐',
    category: '食品',
    tags: [],
    quantity: 1,
    unit: '件',
    location: '厨房',
    expiresAt,
    note: '',
    status: 'normal',
    reminder: {
      enabled: true,
      useDefault: true,
      rules: ['7d', '3d', 'same-day', 'expired'],
      reminderTime: '09:00',
    },
  };
}

describe('getPantryExpiryText', () => {
  const today = new Date('2026-06-14T12:00:00');

  it('keeps short durations in days', () => {
    expect(getPantryExpiryText(pantryItem('2026-06-21'), today)).toBe('7天后到期');
  });

  it('formats month level durations with months and days', () => {
    expect(getPantryExpiryText(pantryItem('2026-08-03'), today)).toBe('1个月20天后到期');
  });

  it('formats year level durations with years, months and days', () => {
    expect(getPantryExpiryText(pantryItem('2031-04-22'), today)).toBe('4年10个月8天后到期');
  });

  it('formats expired long durations with friendly units', () => {
    expect(getPantryExpiryText(pantryItem('2026-04-10'), today)).toBe('已过期2个月4天');
  });
});
