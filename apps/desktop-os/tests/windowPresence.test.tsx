import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const reducedMotionMock = vi.hoisted(() => ({ value: false as boolean | null }));

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => reducedMotionMock.value,
  };
});

// Window 渲染依赖大量浏览器/业务运行时,mock 成最小 stub,只保留 motion 包装
vi.mock('../src/apps/appRenderers', () => ({
  renderDesktopApp: () => null,
}));
vi.mock('../src/ui/PlushScrollbar', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../src/ui/ResizeHandles', () => ({
  default: () => null,
}));
vi.mock('../src/ui/TrafficLights', () => ({
  default: () => null,
}));

import Window from '../src/components/window/Window';
import type { WindowState } from '../src/store/windowStore';
import { PlushPresence } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
});

const baseWindow: WindowState = {
  id: 'finder-1',
  appId: 'finder',
  title: 'Finder',
  x: 80,
  y: 80,
  width: 720,
  height: 480,
  zIndex: 11,
  minimized: false,
  lifecycleState: 'active',
  maximized: false,
};

describe('Window AnimatePresence', () => {
  it('WindowManager 通过 PlushPresence 包裹窗口列表', () => {
    const source = readFileSync(
      new URL('../src/components/window/WindowManager.tsx', import.meta.url),
      'utf8',
    );
    expect(source).toContain('PlushPresence');
    expect(source).toContain("from '../../ui/PlushMotion'");
    expect(source).toMatch(/<PlushPresence[\s>]/);
  });

  it('Window 渲染时 SSR 输出包含 PlushPop enter 包装与 data-window-id', () => {
    const html = renderToStaticMarkup(
      <PlushPresence>
        <Window state={baseWindow} appId={baseWindow.appId} />
      </PlushPresence>,
    );
    expect(html).toContain('data-motion-presence="pop"');
    expect(html).toContain('data-state="enter"');
    expect(html).toContain('data-window-id="finder-1"');
  });

  it('Window 外层 PlushPop motion.div 接管 zIndex / left / top,避免被 stacking context 吞掉', () => {
    const html = renderToStaticMarkup(
      <PlushPresence>
        <Window
          state={{
            id: 'finder-1',
            appId: 'finder',
            title: 'Finder',
            x: 80,
            y: 80,
            width: 720,
            height: 480,
            zIndex: 11,
            minimized: false,
            lifecycleState: 'active',
            maximized: false,
          }}
          appId="finder"
        />
      </PlushPresence>,
    );
    // 外层 motion.div 必须带定位与 zIndex
    expect(html).toMatch(/data-motion-presence="pop"[^>]*style="[^"]*position:\s*absolute/);
    expect(html).toMatch(/data-motion-presence="pop"[^>]*style="[^"]*left:\s*80px/);
    expect(html).toMatch(/data-motion-presence="pop"[^>]*style="[^"]*top:\s*80px/);
    expect(html).toMatch(/data-motion-presence="pop"[^>]*style="[^"]*z-index:\s*11/);
  });
});
