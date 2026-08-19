/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import PrivateLabLayout from './PrivateLabLayout';

function renderAt(path: string) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/workbench" element={<PrivateLabLayout />}>
            <Route index element={<main>实验室首页内容</main>} />
            <Route path="resources" element={<main>资源内容</main>} />
            <Route path="edit" element={<main>编辑器内容</main>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });

  return { container, root };
}

describe('PrivateLabLayout', () => {
  it('provides a focused lab shell and keeps resource tabs directly reachable', () => {
    const { container, root } = renderAt('/workbench/resources?tab=skills');

    expect(container.textContent).toContain('雨迹 · 私有实验室');
    expect(container.textContent).toContain('工作流');
    expect(container.textContent).toContain('知识库');
    expect(container.textContent).toContain('提示词');
    expect(container.textContent).toContain('技能');
    expect(container.textContent).toContain('图片进阶');
    expect(container.textContent).not.toContain('智能体');
    expect(container.textContent).not.toContain('动态表情');
    expect(container.textContent).toContain('资源内容');
    expect(
      container.querySelector('a[href="/workbench/resources?tab=skills"][aria-current="page"]'),
    ).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });

  it('removes the shell around the full-screen workflow editor', () => {
    const { container, root } = renderAt('/workbench/edit?id=workflow-1');

    expect(container.textContent).toBe('编辑器内容');
    expect(container.querySelector('aside')).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
