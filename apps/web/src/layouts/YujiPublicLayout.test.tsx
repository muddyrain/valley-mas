/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  hasHydrated: true,
  isAuthenticated: false,
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (
    selector: (state: { hasHydrated: boolean; isAuthenticated: boolean }) => unknown,
  ) => selector(authState),
}));

import YujiPublicLayout from './YujiPublicLayout';

describe('YujiPublicLayout', () => {
  beforeEach(() => {
    authState.hasHydrated = true;
    authState.isAuthenticated = false;
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
    expect(container.textContent).toContain('文章与影像');
    expect(container.textContent).toContain('文章列表内容');
    expect(container.querySelector('a[aria-current="page"]')?.textContent).toBe('文章');
    expect(container.querySelector('a[href="https://github.com/muddyrain"]')).not.toBeNull();
    expect(container.querySelector('a[href="/studio"]')).toBeNull();

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
