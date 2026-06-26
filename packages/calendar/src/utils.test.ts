import { describe, expect, it } from 'vitest';
import { formatDateKey, getCalendarWeekDays, getCalendarWeekStart, parseDateKey } from './utils';

describe('calendar date utilities', () => {
  it('formats and parses local date keys', () => {
    expect(formatDateKey(new Date(2026, 5, 26))).toBe('2026-06-26');
    expect(parseDateKey('2026-06-26')?.getFullYear()).toBe(2026);
    expect(parseDateKey('2026-02-31')).toBeNull();
    expect(parseDateKey('not-a-date')).toBeNull();
  });

  it('uses Monday as the default week start', () => {
    expect(formatDateKey(getCalendarWeekStart('2026-06-26'))).toBe('2026-06-22');
  });

  it('builds selectable week day cells', () => {
    const days = getCalendarWeekDays('2026-06-26', {
      selectedDate: '2026-06-24',
      today: '2026-06-26',
    });

    expect(days.map((day) => day.dateKey)).toEqual([
      '2026-06-22',
      '2026-06-23',
      '2026-06-24',
      '2026-06-25',
      '2026-06-26',
      '2026-06-27',
      '2026-06-28',
    ]);
    expect(days.map((day) => day.weekdayLabel)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    expect(days.find((day) => day.dateKey === '2026-06-24')?.isSelected).toBe(true);
    expect(days.find((day) => day.dateKey === '2026-06-26')?.isToday).toBe(true);
  });
});
