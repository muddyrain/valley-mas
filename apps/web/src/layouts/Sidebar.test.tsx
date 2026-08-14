/** @vitest-environment jsdom */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { layoutState, authState } = vi.hoisted(() => ({
  layoutState: { sidebarCollapsed: false, toggleSidebar: vi.fn() },
  authState: { user: null, isAuthenticated: false, logout: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, ...props }: { children?: ReactNode; to: string }) => (
    <a href={props.to}>{children}</a>
  ),
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/api/auth', () => ({ logout: vi.fn() }));
vi.mock('@/components/BrandLogo', () => ({ default: () => <span>Valley Logo</span> }));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  AvatarImage: () => null,
}));
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ render }: { render?: ReactNode }) => render,
}));
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <span role="tooltip">{children}</span>
  ),
  TooltipTrigger: ({ render }: { render?: ReactNode }) => render,
}));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ mode: 'system', setMode: vi.fn() }) }));
vi.mock('@/stores/useAuthStore', () => ({ useAuthStore: () => authState }));
vi.mock('@/stores/useLayoutStore', () => ({
  useLayoutStore: (selector: (state: typeof layoutState) => unknown) => selector(layoutState),
}));
vi.mock('./navigation', () => ({ navigationGroups: [], isNavigationActive: () => false }));

import { Sidebar } from './Sidebar';

function renderSidebar(onSearchOpen = vi.fn()) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<Sidebar onSearchOpen={onSearchOpen} />));
  return { container, root, onSearchOpen };
}

function cleanup(container: HTMLElement, root: Root) {
  act(() => root.unmount());
  container.remove();
}

beforeEach(() => {
  vi.clearAllMocks();
  layoutState.sidebarCollapsed = false;
  authState.user = null;
  authState.isAuthenticated = false;
});

describe('Sidebar search entry', () => {
  it('shows an accessible expanded search button and opens the palette', () => {
    const { container, root, onSearchOpen } = renderSidebar();
    const search = container.querySelector('button[aria-label="搜索 Valley"]') as HTMLButtonElement;

    act(() => search.click());

    expect(search.textContent).toContain('搜索');
    expect(onSearchOpen).toHaveBeenCalledTimes(1);
    cleanup(container, root);
  });

  it('keeps the collapsed search trigger accessible with a tooltip', () => {
    layoutState.sidebarCollapsed = true;
    const { container, root } = renderSidebar();

    expect(container.querySelector('button[aria-label="搜索 Valley"]')).not.toBeNull();
    expect(container.querySelector('[role="tooltip"]')?.textContent).toContain('搜索');
    cleanup(container, root);
  });

  it('keeps the studio entry but hides legacy account destinations', () => {
    authState.user = { username: 'muddyrain' } as never;
    authState.isAuthenticated = true;
    const { container, root } = renderSidebar();

    expect(container.textContent).toContain('创作室');
    expect(container.textContent).not.toContain('个人资料编辑');
    expect(container.textContent).not.toContain('我的收藏');
    expect(container.textContent).not.toContain('我的关注');
    expect(container.textContent).not.toContain('下载记录');
    expect(container.textContent).not.toContain('通知设置');

    cleanup(container, root);
  });
});
