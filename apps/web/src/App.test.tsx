/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Outlet } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@valley/devbox-inspector-runtime', () => ({ InspectorRuntime: () => null }));
vi.mock('@/components/GlobalScrollButton', () => ({ GlobalScrollButton: () => null }));
vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ resolvedMode: 'light' }) }));
vi.mock('@/stores/useThemeStore', () => ({ applyThemeToDocument: vi.fn() }));
vi.mock('./pages/YujiHome', () => ({ default: () => <main>雨迹首页内容</main> }));
vi.mock('./pages/YujiArticle', () => ({ default: () => <main>新版文章详情</main> }));
vi.mock('./pages/StudioHome', () => ({ default: () => <main>创作室首页内容</main> }));
vi.mock('./layouts/StudioLayout', () => ({ default: () => <main>创作室首页内容</main> }));
vi.mock('./layouts/PrivateLabLayout', () => ({
  default: () => (
    <section>
      私有实验室外壳
      <Outlet />
    </section>
  ),
}));
vi.mock('./pages/Workbench', () => ({ default: () => <main>智能体项目内容</main> }));
vi.mock('./pages/Login', () => ({ default: () => <main>登录页面</main> }));
let isAuthenticated = false;

vi.mock('./stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated }),
}));

import App from './App';

function renderAt(path: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>,
    ),
  );
  return { container, root };
}

describe('App public routes', () => {
  it('uses the Yuji public shell for the site root', () => {
    const { container, root } = renderAt('/');

    expect(container.textContent).toContain('雨迹首页内容');
    expect(container.textContent).toContain('文章与影像');
    expect(document.title).toContain('雨迹');

    act(() => root.unmount());
    container.remove();
  });

  it('keeps legacy blog detail links working through the new article route', async () => {
    const { container, root } = renderAt('/blog/post-1');
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('新版文章详情');

    act(() => root.unmount());
    container.remove();
  });

  it('protects the studio and keeps the intended return path', async () => {
    isAuthenticated = false;
    const { container, root } = renderAt('/studio/articles/new');
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('登录页面');

    act(() => root.unmount());
    container.remove();
  });

  it('opens the private studio for the authenticated owner', async () => {
    isAuthenticated = true;
    const { container, root } = renderAt('/studio');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('创作室首页内容');

    act(() => root.unmount());
    container.remove();
    isAuthenticated = false;
  });

  it('protects the private lab at the layout boundary', async () => {
    isAuthenticated = false;
    const { container, root } = renderAt('/workbench/resources?tab=skills');
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('登录页面');

    act(() => root.unmount());
    container.remove();
  });

  it('opens the dedicated private lab for the authenticated owner', async () => {
    isAuthenticated = true;
    const { container, root } = renderAt('/workbench');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(container.textContent).toContain('私有实验室外壳');
    expect(container.textContent).toContain('智能体项目内容');

    act(() => root.unmount());
    container.remove();
    isAuthenticated = false;
  });

  it('keeps the Yuji title while redirecting a legacy studio entry', async () => {
    isAuthenticated = true;
    const { container, root } = renderAt('/my-space');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(document.title).toBe('创作室 | 雨迹');

    act(() => root.unmount());
    container.remove();
    isAuthenticated = false;
  });
});
