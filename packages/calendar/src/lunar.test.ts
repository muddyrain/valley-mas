import { describe, expect, it } from 'vitest';
import { getLunarDateInfo } from './lunar';

describe('lunar date utilities', () => {
  it('formats Chinese New Year as the first lunar day', () => {
    expect(getLunarDateInfo('2024-02-10')).toMatchObject({
      year: 2024,
      month: 1,
      day: 1,
      isLeapMonth: false,
      monthName: '正月',
      dayName: '初一',
      text: '正月',
    });
  });

  it('formats Mid-Autumn Festival lunar date', () => {
    expect(getLunarDateInfo('2024-09-17')).toMatchObject({
      year: 2024,
      month: 8,
      day: 15,
      text: '十五',
    });
  });

  it('returns null for unsupported or invalid dates', () => {
    expect(getLunarDateInfo('1899-12-31')).toBeNull();
    expect(getLunarDateInfo('bad-date')).toBeNull();
  });
});
