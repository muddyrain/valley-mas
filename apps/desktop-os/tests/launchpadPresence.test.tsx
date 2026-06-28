import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ControlCenter / NotificationCenter / Launchpad 等顶层面板模块链路会触到 store / window 副作用,
// 在 hoisted 阶段先 stub localStorage 与 addEventListener / removeEventListener,避免 SSR 直渲崩溃。
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

import Launchpad from '../src/components/Launchpad';
import { useLaunchpadStore } from '../src/store/launchpadStore';
import { PlushPop, PlushPresence } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
  useLaunchpadStore.setState({ isOpen: false });
});

describe('Launchpad AnimatePresence', () => {
  it('Launchpad 源码用 PlushPresence + PlushPop 编排进出场，移除了 CLOSE_ANIMATION_MS setTimeout 路径', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/components/Launchpad.tsx'), 'utf8');
    // 使用 PlushMotion
    expect(src).toContain("from '../ui/PlushMotion'");
    expect(src).toMatch(/PlushPresence/);
    expect(src).toMatch(/PlushPop/);
    expect(src).toContain('className="launchpad__motion"');
    // 不再有 CLOSE_ANIMATION_MS
    expect(src).not.toContain('CLOSE_ANIMATION_MS');
    // 不再有 isClosing state
    expect(src).not.toContain('isClosing');
    // 不再有 shouldRender state
    expect(src).not.toContain('shouldRender');
  });

  it('Launchpad motion wrapper owns fullscreen layout during enter and exit animation', () => {
    const css = readFileSync(path.resolve(__dirname, '../src/components/Launchpad.css'), 'utf8');

    expect(css).toContain('.launchpad__motion');
    expect(css).toContain('position: absolute;');
    expect(css).toContain('inset: 0;');
    expect(css).toContain('z-index: 850;');
  });

  it('isOpen=false 时 Launchpad SSR 不输出任何 DOM', () => {
    const html = renderToStaticMarkup(<Launchpad />);
    expect(html).toBe('');
  });

  it('PlushPop 包裹 LaunchpadPanel SSR 含 motion 包装属性', () => {
    // 直接渲染 PlushPop + LaunchpadPanel 结构（参考 spotlightPresence.test.tsx 模式），
    // 不依赖跨 renderToStaticMarkup 调用的 Zustand store 状态。
    const html = renderToStaticMarkup(
      <PlushPresence>
        <PlushPop key="launchpad" open>
          <div className="launchpad__surface" role="dialog" aria-label="启动台">
            <div className="launchpad">启动台</div>
          </div>
        </PlushPop>
      </PlushPresence>,
    );
    expect(html).toContain('data-motion-presence="pop"');
    expect(html).toContain('class="launchpad"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('启动台');
  });
});
