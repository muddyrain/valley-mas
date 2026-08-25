/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authState = vi.hoisted(() => ({
  user: { username: 'muddyrain', nickname: '雨迹', avatar: '' },
  logout: vi.fn(),
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

import StudioLayout from './StudioLayout';

describe('StudioLayout', () => {
  beforeEach(() => {
    authState.logout.mockClear();
  });

  it('renders task-first navigation around the active studio page', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/studio/images/import']}>
          <Routes>
            <Route path="/studio" element={<StudioLayout />}>
              <Route path="images/import" element={<main>导入任务内容</main>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('雨迹');
    expect(container.textContent).toContain('写文章');
    expect(container.textContent).toContain('文章库');
    expect(container.textContent).not.toContain('文章草稿');
    expect(container.textContent).toContain('图片导入');
    expect(container.textContent).toContain('AI 图片');
    expect(container.textContent).toContain('导入任务内容');
    expect(
      container.querySelector('a[href="/studio/images/import"][aria-current="page"]'),
    ).not.toBeNull();
    expect(container.querySelector('button[aria-label="打开雨迹的账户菜单"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('exposes the complete image library as its own active studio task', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/studio/images/library']}>
          <Routes>
            <Route path="/studio" element={<StudioLayout />}>
              <Route path="images/library" element={<main>全部图片内容</main>} />
            </Route>
          </Routes>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain('图片库');
    expect(container.textContent).toContain('全部图片内容');
    expect(
      container.querySelector('a[href="/studio/images/library"][aria-current="page"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('a[href="/studio/images/import"][aria-current="page"]'),
    ).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
