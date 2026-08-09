import { describe, expect, it } from 'vitest';
import { isNavigationActive, navigationGroups } from './navigation';

describe('utility navigation', () => {
  it('exposes the public utility workspace and keeps its active state scoped', () => {
    const toolItems = navigationGroups.find((group) => group.label === '工具')?.items ?? [];

    expect(toolItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ to: '/tools/format', label: '实用工具' })]),
    );
    expect(isNavigationActive('/tools/format', '/tools/format')).toBe(true);
    expect(isNavigationActive('/blog', '/tools/format')).toBe(false);
  });
});
