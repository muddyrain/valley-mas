import { describe, expect, it } from 'vitest';
import { isNavigationActive, navigationGroups } from './navigation';

describe('workbench creation navigation', () => {
  it('exposes the supported AI creation destinations without the removed canvas page', () => {
    const creationItems = navigationGroups.find((group) => group.label === '创作')?.items ?? [];

    expect(creationItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ to: '/workbench/images', label: 'AI 图片' }),
        expect.objectContaining({ to: '/workbench/gifs', label: '动态表情' }),
      ]),
    );
    expect(creationItems.some((item) => item.to === '/workbench/canvas')).toBe(false);
  });

  it('keeps the remaining creation destinations active independently', () => {
    expect(isNavigationActive('/workbench/images', '/workbench/images')).toBe(true);
    expect(isNavigationActive('/workbench/gifs', '/workbench/gifs')).toBe(true);
    expect(isNavigationActive('/workbench/images', '/workbench/gifs')).toBe(false);
  });
});
