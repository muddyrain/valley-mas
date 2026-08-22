/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  hasHydrated: true,
  isAuthenticated: false,
}));

const themeState = vi.hoisted(() => ({
  mode: 'system' as const,
  setMode: vi.fn(),
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: { hasHydrated: boolean; isAuthenticated: boolean }) => unknown,
  ) => selector(authState),
}));

vi.mock('@/stores/useThemeStore', () => ({
  resolveThemeMode: (mode: 'dark' | 'light' | 'system') => (mode === 'system' ? 'light' : mode),
  useThemeStore: (selector: (state: typeof themeState) => unknown) => selector(themeState),
}));

import YujiPublicLayout from './YujiPublicLayout';

describe('YujiPublicLayout', () => {
  beforeEach(() => {
    authState.hasHydrated = true;
    authState.isAuthenticated = false;
    themeState.setMode.mockClear();
  });

  it('renders the public brand, primary navigation and child route', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/articles']}>
          <Routes>
            <Route path="/" element={<YujiPublicLayout />}>
              <Route path="articles" element={<main>文章列表内容</main>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('雨迹');
    expect(container.textContent).toContain('YUJI® / 2026');
    expect(container.textContent).toContain('文章列表内容');
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toBe('文章');
    expect(
      container.querySelector('.yuji-header a[href="https://github.com/muddyrain"]'),
    ).toBeNull();
    expect(
      container.querySelector('.yuji-footer a[href="https://github.com/muddyrain"]'),
    ).not.toBeNull();
    expect(container.querySelector('a[href="/studio"]')).toBeNull();
    expect(container.querySelector('.yuji-route-transition')).toBeNull();
    expect(container.querySelector('.yuji-pixel-trail')).toBeNull();
    expect(container.querySelector('a[href="/search"]')).toBeNull();
    expect(container.querySelector('button[aria-label="搜索文章与影像"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('keeps a direct home navigation entry over the brand stage', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<YujiPublicLayout />}>
              <Route index element={<main>品牌首屏</main>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('.yuji-header')?.classList.contains('is-home-stage')).toBe(true);
    expect(container.querySelector('.yuji-desktop-nav a[href="/"]')?.textContent).toBe('首页');
    expect(container.querySelector('.yuji-brand[aria-current="page"]')).not.toBeNull();
    expect(container.textContent).toContain('YUJI® / 2026');
    expect(container.querySelector('.yuji-pixel-trail[aria-hidden="true"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the system theme consistent when entering an article detail', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/articles/post-1']}>
          <Routes>
            <Route path="/" element={<YujiPublicLayout />}>
              <Route path="articles/:id" element={<main>文章详情内容</main>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('.yuji-site')?.getAttribute('data-public-theme')).toBe('light');

    act(() => root.unmount());
    container.remove();
  });

  it('shows a studio entry in desktop and mobile navigation after authentication', () => {
    authState.isAuthenticated = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<YujiPublicLayout />}>
              <Route index element={<main>首页内容</main>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    const studioLinks = container.querySelectorAll<HTMLAnchorElement>('a[href="/studio"]');
    expect(studioLinks).toHaveLength(2);
    expect(Array.from(studioLinks).every((link) => link.textContent?.trim() === '创作室')).toBe(
      true,
    );
    expect(container.querySelector('.yuji-header-actions a[href="/studio"]')).not.toBeNull();
    expect(container.querySelector('.yuji-mobile-nav a[href="/studio"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
