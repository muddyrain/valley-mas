/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAllResources } = vi.hoisted(() => ({ getAllResources: vi.fn() }));

vi.mock('@/api/resource', () => ({ getAllResources }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载中</div> : null),
}));

import YujiGallery from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getAllResources.mockResolvedValue({
    list: [
      { id: 'image-1', title: '海拉鲁远眺', url: '/one.webp', type: 'wallpaper', tags: ['远行'] },
      { id: 'image-2', title: '春日花园', url: '/two.webp', type: 'wallpaper', tags: ['远行'] },
    ],
    total: 2,
  });
});

describe('YujiGallery', () => {
  it('uses stable gallery themes instead of treating search tags as collections', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter
          initialEntries={['/gallery?collection=%E9%A3%8E%E6%99%AF%E4%B8%8E%E6%83%B3%E8%B1%A1']}
        >
          <YujiGallery />
        </MemoryRouter>,
      ),
    );
    await flush();

    expect(getAllResources).toHaveBeenCalledWith({ page: 1, pageSize: 24, includeTags: true });
    expect(container.textContent).toContain('风景与想象');
    expect(container.textContent).toContain('海拉鲁远眺');
    expect(container.querySelector('a[href="/gallery/image/image-1"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
