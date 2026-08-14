/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyResources } = vi.hoisted(() => ({ getMyResources: vi.fn() }));
vi.mock('@/api/resource', () => ({ getMyResources }));
vi.mock('@/components/BatchUploadResourceDialog', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="batch-dialog">批量上传</div> : null,
}));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载图片</div> : null),
}));

import StudioImageImport from '.';

beforeEach(() => {
  vi.clearAllMocks();
  getMyResources.mockResolvedValue({ list: [], total: 0 });
});

describe('StudioImageImport', () => {
  it('opens the batch workspace without asking for source or license forms', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() =>
      root.render(
        <MemoryRouter>
          <StudioImageImport />
        </MemoryRouter>,
      ),
    );
    await act(async () => Promise.resolve());

    const openButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('选择图片'),
    );
    expect(openButton?.disabled).toBe(false);
    expect(container.textContent).not.toContain('请选择来源');
    expect(container.textContent).not.toContain('请选择许可');
    expect(container.textContent).not.toContain('原始出处');
    expect(container.querySelector('a[href="/studio/images/library"]')?.textContent).toContain(
      '进入图片库',
    );

    act(() => openButton?.click());
    expect(container.querySelector('[data-testid="batch-dialog"]')?.textContent).toBe('批量上传');

    act(() => root.unmount());
    container.remove();
  });
});
