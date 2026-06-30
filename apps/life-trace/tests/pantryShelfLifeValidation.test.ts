import { describe, expect, it } from 'vitest';
import { validatePantryShelfLife } from '../src/lib/pantry';

const today = new Date('2026-06-30T00:00:00');

describe('validatePantryShelfLife', () => {
  it('鲜奶保质期超过 30 天应返回 warning', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶 1L',
      category: '食品',
      expiresAt: '2027-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
    expect(result?.message).toContain('鲜奶');
  });

  it('鲜奶保质期 14 天应通过校验', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶 1L',
      category: '食品',
      expiresAt: '2026-07-14',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('未填名称时不校验', () => {
    const result = validatePantryShelfLife({
      name: '',
      category: '食品',
      expiresAt: '2030-06-30',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('未填过期日期时不校验', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶',
      category: '食品',
      expiresAt: '',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('已过期物品不再提示合理性', () => {
    const result = validatePantryShelfLife({
      name: '鲜奶',
      category: '食品',
      expiresAt: '2026-06-01',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('酸奶 60 天应 warning(酸奶上限 45 天)', () => {
    const result = validatePantryShelfLife({
      name: '原味酸奶',
      category: '食品',
      expiresAt: '2026-08-29',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });

  it('面包 365 天应 warning', () => {
    const result = validatePantryShelfLife({
      name: '全麦面包',
      category: '食品',
      expiresAt: '2027-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });

  it('鸡蛋 7 天应通过', () => {
    const result = validatePantryShelfLife({
      name: '土鸡蛋',
      category: '食品',
      expiresAt: '2026-07-07',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('未匹配关键词时按品类兜底:食品超过 730 天应 warning', () => {
    const result = validatePantryShelfLife({
      name: '某种零食',
      category: '食品',
      expiresAt: '2030-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });

  it('未匹配关键词且品类为日用品,2 年内 OK', () => {
    const result = validatePantryShelfLife({
      name: '抽纸',
      category: '日用品',
      expiresAt: '2028-06-30',
      now: today,
    });
    expect(result).toBeNull();
  });

  it('药品 5 年应 warning(药品上限 3 年)', () => {
    const result = validatePantryShelfLife({
      name: '感冒灵',
      category: '药品',
      expiresAt: '2031-06-30',
      now: today,
    });
    expect(result?.severity).toBe('warning');
  });
});
