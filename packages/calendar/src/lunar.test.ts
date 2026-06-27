import { describe, expect, it } from 'vitest';
import { formatChineseLunarDate, getChineseLunarDate } from './lunar';

describe('Chinese lunar calendar', () => {
  it('formats Spring Festival', () => {
    const lunar = getChineseLunarDate('2026-02-17');

    expect(lunar.month).toBe(1);
    expect(lunar.day).toBe(1);
    expect(lunar.dayName).toBe('初一');
    expect(lunar.festivalName).toBe('春节');
    expect(lunar.displayName).toBe('春节');
    expect(lunar.zodiacName).toBe('马');
  });

  it('formats Dragon Boat Festival', () => {
    const lunar = getChineseLunarDate('2026-06-19');

    expect(lunar.monthName).toBe('五月');
    expect(lunar.dayName).toBe('初五');
    expect(lunar.festivalName).toBe('端午');
    expect(formatChineseLunarDate('2026-06-19')).toBe('农历丙午年五月初五');
  });

  it('detects Lunar New Year Eve by the next lunar day', () => {
    const lunar = getChineseLunarDate('2026-02-16');

    expect(lunar.festivalName).toBe('除夕');
    expect(lunar.displayName).toBe('除夕');
  });
});
