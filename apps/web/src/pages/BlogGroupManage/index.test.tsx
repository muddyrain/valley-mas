/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getAdminGroups: vi.fn() }));
vi.mock('@/api/blog', () => ({
  getAdminGroups: api.getAdminGroups,
  createGroup: vi.fn(),
  updateGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));
vi.mock('@/stores/useAuthStore', () => ({ useAuthStore: () => ({ isAuthenticated: true }) }));
vi.mock('@/components/PanelLoadingOverlay', () => ({ default: () => null }));
vi.mock('@/components/ui/confirm-toast', () => ({ openConfirmToast: vi.fn() }));

import BlogGroupManage from '.';

beforeEach(() => {
  vi.clearAllMocks();
  api.getAdminGroups.mockResolvedValue([{ id: 'react', name: 'React', postCount: 2 }]);
});

describe('BlogGroupManage', () => {
  it('uses the studio-facing column terminology without migrating group data', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/studio/columns']}>
          <BlogGroupManage />
        </MemoryRouter>,
      ),
    );
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('专栏管理');
    expect(container.textContent).toContain('React');
    expect(container.textContent).not.toContain('博客分组管理');
    expect(api.getAdminGroups).toHaveBeenCalledWith({ groupType: 'blog' });

    act(() => root.unmount());
    container.remove();
  });
});
