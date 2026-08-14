/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import YujiAbout from '.';

describe('YujiAbout', () => {
  it('states the site purpose and links the public author identity', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <YujiAbout />
        </MemoryRouter>,
      ),
    );

    expect(container.textContent).toContain('写代码，也收集让人停留片刻的画面');
    expect(container.textContent).toContain('更新没有固定周期');
    expect(container.querySelector('a[href="https://github.com/muddyrain"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
