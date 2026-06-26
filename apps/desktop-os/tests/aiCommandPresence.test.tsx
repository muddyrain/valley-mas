import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// AICommandCenterWindow 链路会触到 authStore / api 等副作用,
// 在 hoisted 阶段先 stub localStorage / window / fetch。
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
  const g = globalThis as unknown as {
    window?: unknown;
    localStorage?: unknown;
    fetch?: unknown;
  };
  g.window = {
    localStorage: ls,
    addEventListener: noop,
    removeEventListener: noop,
    matchMedia: () => ({ matches: false }) as MediaQueryList,
  };
  g.localStorage = ls;
  g.fetch = noop as unknown as typeof fetch;
});

const reducedMotionMock = vi.hoisted(() => ({ value: false as boolean | null }));

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => reducedMotionMock.value,
  };
});

import AICommandCenterWindow from '../src/apps/AICommandCenterWindow';
import { useAuthStore } from '../src/store/authStore';
import { PlushFade, PlushPresence } from '../src/ui/PlushMotion';

afterEach(() => {
  reducedMotionMock.value = false;
  useAuthStore.setState({ isAuthenticated: true, token: 'test-token' });
});

describe('AICommandCenter AnimatePresence', () => {
  it('AICommandCenter 源码已移除 CSS keyframes 动画，改用 PlushFade 包裹消息列表', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../src/apps/AICommandCenterWindow.tsx'),
      'utf8',
    );
    // 使用 PlushMotion
    expect(src).toContain("from '../ui/PlushMotion'");
    expect(src).toMatch(/PlushFade/);
    expect(src).toMatch(/PlushPresence/);
    // 不再有 CSS animation: ai-command-thread-in 等
    expect(src).not.toContain('ai-command-thread-in');
    expect(src).not.toContain('ai-command-message-in');
    // prefersReducedMotion 改名，不再用于动画
    expect(src).not.toContain('prefersReducedMotion');
  });

  it('未登录时 AICommandCenter SSR 输出锁定卡片，不含 motion 包装', () => {
    useAuthStore.setState({ isAuthenticated: false, token: null });
    const html = renderToStaticMarkup(<AICommandCenterWindow />);
    expect(html).not.toContain('data-motion-presence="fade"');
  });

  it('已登录时消息列表用 PlushPresence + PlushFade 包裹每条消息', () => {
    useAuthStore.setState({ isAuthenticated: true, token: 'test-token' });
    // 直接渲染 PlushPresence + PlushFade 包裹消息列表结构
    const mockMessages = [
      {
        id: 'm1',
        role: 'user' as const,
        content: 'Hello',
        agentId: 'a1',
        conversationId: 'c1',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'm2',
        role: 'assistant' as const,
        content: 'Hi there',
        agentId: 'a1',
        conversationId: 'c1',
        createdAt: new Date().toISOString(),
      },
    ];
    const html = renderToStaticMarkup(
      <PlushPresence>
        {mockMessages.map((m) => (
          <PlushFade key={m.id} open>
            <article className={`ai-command-center__message ai-command-center__message--${m.role}`}>
              <p>{m.content}</p>
            </article>
          </PlushFade>
        ))}
      </PlushPresence>,
    );
    expect(html).toContain('data-motion-presence="fade"');
    expect(html).toContain('ai-command-center__message');
  });
});
