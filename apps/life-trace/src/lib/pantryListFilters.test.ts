import { describe, expect, it } from 'vitest';
import {
  buildPantryListSearchParams,
  getPantryRefreshPageSize,
  isSamePantryListQuery,
  readPantryListFilters,
  toPantryListApiOptions,
} from './pantryListFilters';

describe('pantry list filters', () => {
  it('uses remembered include-expired and sort preferences for a fresh pantry route', () => {
    expect(
      readPantryListFilters(new URLSearchParams(), {
        includeExpired: true,
        sort: 'created-desc',
      }),
    ).toEqual({
      status: 'all',
      category: 'all',
      includeExpired: true,
      sort: 'created-desc',
      q: '',
    });
  });

  it('serializes only active URL conditions in a stable order', () => {
    const params = buildPantryListSearchParams({
      status: 'expired',
      category: '食品',
      includeExpired: true,
      sort: 'expiry-asc',
      q: ' 牛奶 ',
    });

    expect(params.toString()).toBe(
      'status=expired&category=%E9%A3%9F%E5%93%81&q=%E7%89%9B%E5%A5%B6',
    );
  });

  it('only sends includeExpired for the current inventory view', () => {
    expect(
      toPantryListApiOptions({
        status: 'all',
        category: 'all',
        includeExpired: true,
        sort: 'expiry-asc',
        q: '',
      }),
    ).toMatchObject({ status: 'all', includeExpired: true });

    expect(
      toPantryListApiOptions({
        status: 'expired',
        category: 'all',
        includeExpired: true,
        sort: 'expiry-asc',
        q: '',
      }),
    ).not.toHaveProperty('includeExpired');
  });

  it('compares the query identity without pagination fields', () => {
    expect(
      isSamePantryListQuery(
        { status: 'all', category: 'all', sort: 'expiry-asc', page: 1, pageSize: 20 },
        { status: 'all', category: 'all', sort: 'expiry-asc', page: 3, pageSize: 40 },
      ),
    ).toBe(true);

    expect(
      isSamePantryListQuery(
        { status: 'all', category: 'all', sort: 'expiry-asc', q: '牛奶' },
        { status: 'all', category: 'all', sort: 'expiry-asc', q: '鸡蛋' },
      ),
    ).toBe(false);
  });

  it('keeps every loaded item when the same query refreshes', () => {
    expect(getPantryRefreshPageSize(20, 40, true)).toBe(40);
    expect(getPantryRefreshPageSize(20, 40, false)).toBe(20);
  });
});
