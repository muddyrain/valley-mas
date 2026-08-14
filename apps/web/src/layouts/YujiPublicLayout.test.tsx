/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import YujiPublicLayout from './YujiPublicLayout';

describe('YujiPublicLayout', () => {
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

    act(() => root.unmount());
    container.remove();
  });
});
