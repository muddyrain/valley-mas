import { describe, expect, it } from 'vitest';
import { isNavigationActive, navigationGroups } from './navigation';

describe('private workspace navigation', () => {
  it('keeps daily creation in the studio and advanced tools in the private lab', () => {
    const creationItems = navigationGroups.find((group) => group.label === '创作')?.items ?? [];

    expect(creationItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: '/studio', label: '创作室' }),
        expect.objectContaining({ to: '/workbench', label: '私有实验室' }),
      ]),
    );
    expect(creationItems.some((item) => item.to === '/workbench/images')).toBe(false);
  });

  it('keeps studio and lab destinations active independently', () => {
    expect(isNavigationActive('/studio/articles/new', '/studio')).toBe(true);
    expect(isNavigationActive('/workbench/apps/1', '/workbench')).toBe(true);
    expect(isNavigationActive('/studio', '/workbench')).toBe(false);
  });
});
