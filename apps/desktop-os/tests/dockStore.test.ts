import { describe, expect, it } from 'vitest';
import { getDesktopApp } from '../src/apps/desktopApps';
import { buildDefaultDockItems, mergeDockItems } from '../src/store/dockStore';

describe('dock store model', () => {
  it('builds dock items from the app registry while keeping hidden apps configurable', () => {
    const items = buildDefaultDockItems();

    expect(items.find((item) => item.id === 'finder')).toMatchObject({
      id: 'finder',
      label: getDesktopApp('finder').title,
      icon: getDesktopApp('finder').icon,
      appId: 'finder',
      visible: true,
      pinned: true,
      canOpenWindow: true,
      required: true,
    });
    expect(items.find((item) => item.id === 'plushMatch')).toMatchObject({
      id: 'plushMatch',
      label: getDesktopApp('plushMatch').title,
      icon: getDesktopApp('plushMatch').icon,
      appId: 'plushMatch',
      visible: false,
      pinned: false,
      canOpenWindow: true,
    });
    expect(items.find((item) => item.id === 'launchpad')).toMatchObject({
      id: 'launchpad',
      action: 'launchpad',
      visible: true,
      pinned: true,
      canOpenWindow: false,
      required: true,
    });
  });

  it('merges saved dock order without losing new registry items or required app visibility', () => {
    const merged = mergeDockItems(buildDefaultDockItems(), [
      { id: 'music', visible: false, pinned: false },
      { id: 'finder', visible: false, pinned: false },
      { id: 'missing-old-app', visible: true, pinned: true },
    ]);

    expect(merged.slice(0, 2).map((item) => item.id)).toEqual(['music', 'finder']);
    expect(merged.find((item) => item.id === 'finder')).toMatchObject({
      visible: true,
      pinned: true,
    });
    expect(merged.find((item) => item.id === 'settings')).toBeDefined();
    expect(merged.find((item) => item.id === 'plushMatch')).toMatchObject({
      visible: false,
      pinned: false,
    });
    expect(merged.some((item) => item.id === 'missing-old-app')).toBe(false);
  });
});
