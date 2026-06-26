import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ControlCenter / NotificationCenter 等顶层面板模块链路会触到 store / window 副作用,
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

import ControlCenter, { ControlCenterPanel } from '../src/components/ControlCenter';
import NotificationCenter, { NotificationCenterPanel } from '../src/components/NotificationCenter';
import { useControlCenterStore } from '../src/store/controlCenterStore';
import { useNotificationCenterStore } from '../src/store/notificationCenterStore';
import { PlushFade, PlushPresence, PlushSlide } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
  useControlCenterStore.setState({ isOpen: false });
  useNotificationCenterStore.setState({
    isOpen: false,
    notifications: [],
    loading: false,
    error: null,
  });
});

describe('Panel slide AnimatePresence', () => {
  describe('ControlCenter', () => {
    it('ControlCenter 源码用 PlushPresence + PlushSlide 编排进出场', () => {
      const src = readFileSync(
        path.resolve(__dirname, '../src/components/ControlCenter.tsx'),
        'utf8',
      );
      expect(src).toContain("from '../ui/PlushMotion'");
      expect(src).toMatch(/PlushPresence/);
      expect(src).toMatch(/PlushSlide[\s\S]*?key="control-center"[\s\S]*?from="top"/);
    });

    it('isOpen=false 时 ControlCenter SSR 输出不含 motion 包装', () => {
      const html = renderToStaticMarkup(<ControlCenter />);
      expect(html).not.toContain('data-motion-presence="slide"');
      expect(html).not.toContain('class="control-center"');
    });

    it('PlushPresence + PlushSlide 包裹 ControlCenterPanel SSR 输出含 motion 包装 + control-center', () => {
      const html = renderToStaticMarkup(
        <PlushPresence>
          <PlushSlide key="control-center" open from="top">
            <ControlCenterPanel />
          </PlushSlide>
        </PlushPresence>,
      );
      expect(html).toContain('data-motion-presence="slide"');
      expect(html).toContain('data-from="top"');
      expect(html).toContain('data-state="enter"');
      expect(html).toContain('class="control-center"');
    });
  });

  describe('NotificationCenter', () => {
    it('NotificationCenter 源码用 PlushPresence + PlushSlide(from="right") + PlushFade 编排进出场', () => {
      const src = readFileSync(
        path.resolve(__dirname, '../src/components/NotificationCenter.tsx'),
        'utf8',
      );
      expect(src).toContain("from '../ui/PlushMotion'");
      expect(src).toMatch(/PlushPresence/);
      expect(src).toMatch(/PlushSlide[\s\S]*?key="notification-center"[\s\S]*?from="right"/);
      // PlushFade 包裹通知卡，使用 spread 传递 data-notification-id
      expect(src).toMatch(/PlushFade[\s\S]*?key=\{n\.id\}/);
      expect(src).toMatch(/\.\.\.\{\s*['"]data-notification-id['"]:\s*n\.id\s*\}/);
    });

    it('isOpen=false 时 NotificationCenter SSR 输出不含 motion 包装', () => {
      const html = renderToStaticMarkup(<NotificationCenter />);
      expect(html).not.toContain('data-motion-presence="slide"');
      expect(html).not.toContain('class="notification-center"');
    });

    it('PlushPresence + PlushSlide + NotificationCenterPanel SSR 含 motion 包装属性', () => {
      const html = renderToStaticMarkup(
        <PlushPresence>
          <PlushSlide key="notification-center" open from="right">
            <NotificationCenterPanel />
          </PlushSlide>
        </PlushPresence>,
      );
      expect(html).toContain('data-motion-presence="slide"');
      expect(html).toContain('data-from="right"');
      expect(html).toContain('data-state="enter"');
      expect(html).toContain('class="notification-center"');
    });

    it('通知列表有数据时 PlushFade 包裹每条通知', () => {
      // 直接渲染 NotificationCenterPanel 而不经过 store，直接检查源码中的 PlushFade 配置
      const src = readFileSync(
        path.resolve(__dirname, '../src/components/NotificationCenter.tsx'),
        'utf8',
      );
      // 验证通知列表 map 块使用了 PlushPresence + PlushFade 包裹 NotificationCard
      expect(src).toMatch(
        /PlushPresence[\s\S]*?\{visibleNotifications\.map\(\(n\)[\s\S]*?PlushFade/,
      );
      expect(src).toMatch(/data-notification-id['"]:\s*n\.id/);
    });
  });
});
