/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/workbench/AIAppsPanel', () => ({
  AIAppsPanel: () => <h1>智能体</h1>,
}));

import Workbench from './index';

describe('Workbench', () => {
  it('uses the shared lab frame without a redundant project heading', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<Workbench />));

    expect(container.querySelector('[data-slot="private-lab-page"]')).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
    expect(container.textContent).not.toContain('项目');

    act(() => root.unmount());
    container.remove();
  });
});
