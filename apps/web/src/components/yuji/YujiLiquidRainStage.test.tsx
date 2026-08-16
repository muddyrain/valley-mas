/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useYujiMagicScroll', () => ({
  useYujiMagicScroll: vi.fn(),
}));

import YujiLiquidRainStage from './YujiLiquidRainStage';

describe('YujiLiquidRainStage', () => {
  it('renders an immediately usable brand statement and dual content portals', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <MemoryRouter>
          <YujiLiquidRainStage />
        </MemoryRouter>,
      );
    });

    expect(container.querySelector('h1')?.textContent).toBe('雨迹');
    expect(container.textContent).toContain('在技术与影像之间，留下思考的痕迹。');
    expect(container.querySelector('a[href="/articles"]')?.textContent).toContain('文章');
    expect(container.querySelector('a[href="/gallery"]')?.textContent).toContain('影像');
    expect(container.querySelector('canvas')?.parentElement?.getAttribute('aria-hidden')).toBe(
      'true',
    );

    act(() => root.unmount());
    container.remove();
  });
});
