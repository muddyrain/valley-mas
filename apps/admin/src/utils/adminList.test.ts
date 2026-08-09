import { describe, expect, it } from 'vitest';
import { matchesKeyword, paginateLocalList } from './adminList.ts';

describe('admin list utilities', () => {
  it('returns the requested page and total count', () => {
    const result = paginateLocalList(['a', 'b', 'c', 'd', 'e'], 2, 2);

    expect(result).toEqual({
      list: ['c', 'd'],
      total: 5,
      page: 2,
      pageSize: 2,
    });
  });

  it('clamps an out-of-range page after records are removed', () => {
    const result = paginateLocalList(['a', 'b', 'c'], 4, 2);

    expect(result).toEqual({
      list: ['c'],
      total: 3,
      page: 2,
      pageSize: 2,
    });
  });

  it('matches trimmed keywords case-insensitively across fields', () => {
    expect(matchesKeyword('  ALP  ', ['Alpha group', 'blog'])).toBe(true);
    expect(matchesKeyword('image', ['Alpha group', 'blog'])).toBe(false);
  });
});
