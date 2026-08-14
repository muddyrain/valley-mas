/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGroups, getPosts } = vi.hoisted(() => ({ getGroups: vi.fn(), getPosts: vi.fn() }));

vi.mock('@/api/blog', () => ({ getGroups, getPosts }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载中</div> : null),
}));

import YujiArticles from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getGroups.mockResolvedValue([{ id: 'react', name: 'React' }]);
  getPosts.mockResolvedValue({
    list: [
      {
        id: 'post-1',
        title: '错误边界',
        excerpt: '局部异常不应该让整个界面消失。',
        group: { name: 'React' },
        createdAt: '2026-08-06T00:00:00Z',
      },
    ],
    total: 1,
  });
});

describe('YujiArticles', () => {
  it('restores the selected column from the URL and requests matching posts', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter initialEntries={['/articles?groupId=react']}>
          <YujiArticles />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(getPosts).toHaveBeenCalledWith({ page: 1, pageSize: 12, groupId: 'react' });
    expect(container.textContent).toContain('错误边界');
    expect(container.querySelector('a[aria-current="true"]')?.textContent).toBe('React');
    expect(container.querySelector('a[href="/articles/post-1"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
