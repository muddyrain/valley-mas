/** @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

const { layoutState } = vi.hoisted(() => ({
  layoutState: {
    aiPanelOpen: false,
    toggleAIPanel: vi.fn(),
    setAIPanelOpen: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  Outlet: () => <div>页面内容</div>,
  useLocation: () => ({ pathname: '/' }),
}));
vi.mock('@/components/search/GlobalCommandPalette', () => ({
  GlobalCommandPalette: ({ open }: { open: boolean }) => (
    <output data-testid="palette">{String(open)}</output>
  ),
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children }: { children?: ReactNode }) => <button type="button">{children}</button>,
}));
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/layouts/AIPanel', () => ({ AIPanel: () => null }));
vi.mock('@/layouts/Sidebar', () => ({
  Sidebar: ({ onSearchOpen }: { onSearchOpen: () => void }) => (
    <button type="button" onClick={onSearchOpen}>
      桌面搜索
    </button>
  ),
}));
vi.mock('@/layouts/MobileNavigation', () => ({ MobileNavigation: () => null }));
vi.mock('@/stores/useLayoutStore', () => ({
  useLayoutStore: (selector: (state: typeof layoutState) => unknown) => selector(layoutState),
}));

import WorkbenchLayout from './WorkbenchLayout';

describe('WorkbenchLayout command palette wiring', () => {
  it('holds transient palette state locally and opens it from the sidebar', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<WorkbenchLayout />));

    expect(container.querySelector('[data-testid="palette"]')?.textContent).toBe('false');
    act(() => (container.querySelector('button') as HTMLButtonElement).click());
    expect(container.querySelector('[data-testid="palette"]')?.textContent).toBe('true');

    act(() => root.unmount());
    container.remove();
  });
});
