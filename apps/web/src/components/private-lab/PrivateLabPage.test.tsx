/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { PrivateLabPage, PrivateLabPageHeader } from './PrivateLabPage';

describe('PrivateLabPage', () => {
  it('provides one consistent content frame and page heading', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PrivateLabPage>
          <PrivateLabPageHeader
            title="智能体"
            description="配置、调试并发布可复用的 AI 能力。"
            actions={<button type="button">创建智能体</button>}
          />
          <section>页面内容</section>
        </PrivateLabPage>,
      );
    });

    const page = container.querySelector('[data-slot="private-lab-page"]');
    expect(page).not.toBeNull();
    expect(page?.querySelector('[data-slot="private-lab-page-content"]')).not.toBeNull();
    expect(page?.querySelector('h1')?.textContent).toBe('智能体');
    expect(page?.textContent).toContain('配置、调试并发布可复用的 AI 能力。');
    expect(page?.textContent).toContain('创建智能体');
    expect(page?.textContent).toContain('页面内容');

    act(() => root.unmount());
    container.remove();
  });
});
