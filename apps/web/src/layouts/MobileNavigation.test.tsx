/** @vitest-environment jsdom */

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authState } = vi.hoisted(() => ({
  authState: { user: null, isAuthenticated: false, logout: vi.fn() },
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children?: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => vi.fn(),
}));
vi.mock('@/api/auth', () => ({ logout: vi.fn() }));
vi.mock('@/components/BrandLogo', () => ({ default: () => <span>Logo</span> }));
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
vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ mode: 'system', setMode: vi.fn() }) }));
vi.mock('@/stores/useAuthStore', () => ({ useAuthStore: () => authState }));
vi.mock('./navigation', async () => {
  const { Home, ImageIcon, Sparkles, User } = await import('lucide-react');
  return {
    isNavigationActive: () => false,
    navigationGroups: [
      {
        label: '浏览',
        items: [
          { to: '/', label: '首页', icon: Home },
          { to: '/blog', label: '博客', icon: Home },
          { to: '/resources', label: '资源', icon: ImageIcon },
        ],
      },
      {
        label: '创作',
        items: [
          { to: '/workbench', label: '智能体', icon: Sparkles },
          { to: '/workbench/images', label: 'AI 图片', icon: User },
        ],
      },
    ],
  };
});

import { MobileNavigation } from './MobileNavigation';

beforeEach(() => {
  authState.user = null;
  authState.isAuthenticated = false;
});

describe('MobileNavigation search entry', () => {
  it('keeps menu, logo, search and account controls in the top bar', () => {
    const onSearchOpen = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(<MobileNavigation onSearchOpen={onSearchOpen} />));

    const header = container.querySelector('header') as HTMLElement;
    expect(header.querySelector('[aria-label="打开导航"]')).not.toBeNull();
    expect(header.querySelector('[aria-label="Valley 首页"]')).not.toBeNull();
    expect(header.querySelector('[aria-label="搜索 Valley"]')).not.toBeNull();
    expect(header.querySelector('[aria-label="登录"]')).not.toBeNull();

    act(() => (header.querySelector('[aria-label="搜索 Valley"]') as HTMLButtonElement).click());
    expect(onSearchOpen).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it('keeps the studio entry but hides legacy account destinations', () => {
    authState.user = { username: 'muddyrain' } as never;
    authState.isAuthenticated = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => root.render(<MobileNavigation onSearchOpen={vi.fn()} />));

    expect(container.textContent).toContain('创作室');
    expect(container.textContent).not.toContain('个人资料');
    expect(container.textContent).not.toContain('我的收藏');
    expect(container.textContent).not.toContain('我的关注');
    expect(container.textContent).not.toContain('下载记录');
    expect(container.textContent).not.toContain('通知设置');

    act(() => root.unmount());
    container.remove();
  });
});
