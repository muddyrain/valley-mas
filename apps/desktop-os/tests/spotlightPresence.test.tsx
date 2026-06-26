import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Spotlight 模块链路依赖 authStore,会在 import 时读取 window.localStorage,这里在 hoisted 阶段先 stub。
// 同时为 motion-dom 在 SSR 环境下访问 window.addEventListener 提供 no-op,避免直渲 motion 子树时崩溃。
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

import SpotlightGate, { SpotlightPanel } from '../src/spotlight/Spotlight';
import { useSpotlightStore } from '../src/store/spotlightStore';
import { PlushPop, PlushPresence } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
  useSpotlightStore.setState({ isOpen: false });
});

describe('Spotlight AnimatePresence', () => {
  it('SpotlightGate 源码用 PlushPresence + PlushPop 编排进出场', () => {
    const src = readFileSync(path.resolve(__dirname, '../src/spotlight/Spotlight.tsx'), 'utf8');
    expect(src).toContain("from '../ui/PlushMotion'");
    expect(src).toMatch(/PlushPresence/);
    expect(src).toMatch(/PlushPop[\s\S]*key="spotlight"[\s\S]*open/);
  });

  it('isOpen=false 时 SpotlightGate SSR 输出不含 motion 包装', () => {
    const html = renderToStaticMarkup(<SpotlightGate />);
    expect(html).not.toContain('data-motion-presence="pop"');
    expect(html).not.toContain('class="spotlight"');
  });

  it('PlushPresence + PlushPop 包裹 SpotlightPanel SSR 输出含 motion 包装 + spotlight 全屏遮罩 + panel', () => {
    const html = renderToStaticMarkup(
      <PlushPresence>
        <PlushPop key="spotlight" open>
          <SpotlightPanel />
        </PlushPop>
      </PlushPresence>,
    );
    expect(html).toContain('data-motion-presence="pop"');
    expect(html).toContain('data-state="enter"');
    expect(html).toContain('class="spotlight"');
    expect(html).toContain('spotlight__panel');
  });
});
