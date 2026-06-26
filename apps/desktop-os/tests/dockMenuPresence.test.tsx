import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Dock 模块链路最终会触到 dockStore / windowStore / launchpadStore,模块加载阶段可能读 window.localStorage,
// 同时 motion-dom SSR 路径会调 window.addEventListener。这里在 hoisted 阶段先 stub。
vi.hoisted(() => {
  const storage = new Map<string, string>();
  const ls = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
    clear: () => {
      storage.clear();
    },
  };
  const noop = () => {};
  const g = globalThis as unknown as { window?: unknown; localStorage?: unknown };
  g.window = {
    localStorage: ls,
    addEventListener: noop,
    removeEventListener: noop,
  };
  g.localStorage = ls;
});

const reducedMotionMock = vi.hoisted(() => ({ value: false as boolean | null }));

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => reducedMotionMock.value,
  };
});

import Dock, { DockContextMenu } from '../src/components/Dock';
import type { DockItemConfig } from '../src/store/dockStore';
import { PlushPop, PlushPresence } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
});

const mockItem: DockItemConfig = {
  id: 'finder',
  label: '访达',
  icon: '/icons/finder.png',
  appId: 'finder',
  visible: true,
  pinned: true,
  canOpenWindow: true,
};

describe('Dock context menu AnimatePresence', () => {
  it('Dock 源码用 PlushPresence + PlushPop 编排菜单进出场', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/components/Dock.tsx'), 'utf8');
    expect(src).toContain("from '../ui/PlushMotion'");
    expect(src).toMatch(/PlushPresence/);
    expect(src).toMatch(/PlushPop[\s\S]*key="dock-menu"[\s\S]*open/);
  });

  it('menu=null 时 Dock SSR 输出不含 motion 包装', () => {
    const html = renderToStaticMarkup(<Dock />);
    expect(html).not.toContain('data-motion-presence="pop"');
    expect(html).not.toContain('class="dock-menu"');
  });

  it('PlushPresence + PlushPop 包裹 DockContextMenu SSR 输出含 motion 包装 + dock-menu', () => {
    const html = renderToStaticMarkup(
      <PlushPresence>
        <PlushPop key="dock-menu" open>
          <DockContextMenu
            item={mockItem}
            menuRef={createRef<HTMLDivElement>()}
            menuPosition={{ left: 0, top: 0 }}
            hasPrimaryMenuAction
            openLabel="打开"
            onOpen={() => {}}
            onPin={() => {}}
            onRemove={() => {}}
            onOpenSettings={() => {}}
            onPointerDown={() => {}}
          />
        </PlushPop>
      </PlushPresence>,
    );
    expect(html).toContain('data-motion-presence="pop"');
    expect(html).toContain('data-state="enter"');
    expect(html).toContain('class="dock-menu"');
  });
});
