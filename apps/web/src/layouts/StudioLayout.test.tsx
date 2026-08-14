/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import StudioLayout from './StudioLayout';

describe('StudioLayout', () => {
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
    expect(container.textContent).toContain('图片导入');
    expect(container.textContent).toContain('AI 图片');
    expect(container.textContent).toContain('导入任务内容');
    expect(
      container.querySelector('a[href="/studio/images/import"][aria-current="page"]'),
    ).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
