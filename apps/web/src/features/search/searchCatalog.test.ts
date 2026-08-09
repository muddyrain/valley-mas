import { describe, expect, it } from 'vitest';
import {
  buildSearchResultUrl,
  filterSearchCommands,
  normalizeSearchQuery,
  searchCommandCatalog,
} from './searchCatalog';

describe('searchCatalog', () => {
  it('normalizes surrounding whitespace and caps long queries', () => {
    expect(normalizeSearchQuery('  Valley 搜索  ')).toBe('Valley 搜索');
    expect(normalizeSearchQuery('a'.repeat(120))).toHaveLength(100);
  });

  it.each([
    ['title', '博客', '/blog'],
    ['keyword', '文章', '/blog'],
    ['path', '/tools/format', '/tools/format'],
    ['case-insensitive English', 'AI IMAGE', '/workbench/images'],
    ['Chinese', '玩具攀爬', '/labs/climber'],
  ])('matches commands by %s', (_label, query, expectedPath) => {
    expect(
      filterSearchCommands(searchCommandCatalog, query, true).map((item) => item.path),
    ).toContain(expectedPath);
  });

  it('does not expose the removed AI canvas page', () => {
    expect(searchCommandCatalog.some((item) => item.path === '/workbench/canvas')).toBe(false);
    expect(filterSearchCommands(searchCommandCatalog, 'AI 画布', true)).toEqual([]);
  });

  it('hides auth-only commands for signed-out users', () => {
    expect(filterSearchCommands(searchCommandCatalog, '我的', false)).toEqual([]);
    expect(filterSearchCommands(searchCommandCatalog, '我的', true).length).toBeGreaterThan(0);
  });

  it('deduplicates commands that resolve to the same path', () => {
    const duplicated = [searchCommandCatalog[0], { ...searchCommandCatalog[0], id: 'duplicate' }];
    expect(filterSearchCommands(duplicated, '', true)).toHaveLength(1);
  });

  it('builds an encoded search URL without meaningless defaults', () => {
    expect(buildSearchResultUrl('  壁纸 & avatar  ')).toBe(
      '/search?q=%E5%A3%81%E7%BA%B8+%26+avatar',
    );
    expect(buildSearchResultUrl('   ')).toBe('/search');
  });
});
