/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getResourceDetail, downloadResource } = vi.hoisted(() => ({
  getResourceDetail: vi.fn(),
  downloadResource: vi.fn(),
}));

vi.mock('@/api/resource', () => ({ getResourceDetail, downloadResource }));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载中</div> : null),
}));

import YujiImage from '.';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  downloadResource.mockResolvedValue({ downloadUrl: '/image.webp' });
  getResourceDetail.mockResolvedValue({
    id: 'image-1',
    title: '海拉鲁远眺',
    url: '/image.webp',
    type: 'wallpaper',
    width: 3840,
    height: 2160,
    userName: 'muddyrain',
    tags: ['远行'],
  });
});

describe('YujiImage', () => {
  it('shows image facts without inventing unknown licensing information', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/gallery/image/image-1']}>
          <Routes>
            <Route path="/gallery/image/:id" element={<YujiImage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.textContent).toContain('海拉鲁远眺');
    expect(container.textContent).toContain('3840 × 2160');
    expect(container.textContent).toContain('许可尚未确认');
    expect(container.querySelector('button[disabled]')?.textContent).toContain('下载未开放');

    act(() => root.unmount());
    container.remove();
  });

  it('shows persisted provenance and only enables permitted downloads', async () => {
    getResourceDetail.mockResolvedValue({
      id: 'image-2',
      title: '雨后远山',
      url: '/mountain.webp',
      type: 'wallpaper',
      sourceKind: 'original',
      sourceUrl: 'https://example.com/original',
      license: 'download_allowed',
      downloadAllowed: true,
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/gallery/image/image-2']}>
          <Routes>
            <Route path="/gallery/image/:id" element={<YujiImage />} />
          </Routes>
        </MemoryRouter>,
      );
    });
    await flush();

    expect(container.textContent).toContain('本人创作');
    expect(container.textContent).toContain('允许站内下载');
    expect(container.querySelector('button[disabled]')).toBeNull();
    expect(container.querySelector('a[href="https://example.com/original"]')).not.toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});
