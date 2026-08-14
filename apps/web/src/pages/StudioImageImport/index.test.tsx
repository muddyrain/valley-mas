/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMyResources } = vi.hoisted(() => ({ getMyResources: vi.fn() }));
vi.mock('@/api/resource', () => ({ getMyResources }));
vi.mock('@/components/BatchUploadResourceDialog', () => ({
  default: ({
    open,
    policy,
  }: {
    open: boolean;
    policy: { sourceKind: string; license: string };
  }) =>
    open ? (
      <div data-testid="batch-dialog">
        {policy.sourceKind}:{policy.license}
      </div>
    ) : null,
}));
vi.mock('@/components/BoxLoadingOverlay', () => ({
  default: ({ show }: { show: boolean }) => (show ? <div>加载图片</div> : null),
}));

import StudioImageImport from '.';

function selectValue(element: HTMLSelectElement, value: string) {
  act(() => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getMyResources.mockResolvedValue({ list: [], total: 0 });
});

describe('StudioImageImport', () => {
  it('requires batch source and license before choosing images', async () => {
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
    expect(openButton?.disabled).toBe(true);

    const selects = container.querySelectorAll('select');
    selectValue(selects[0], 'original');
    selectValue(selects[1], 'download_allowed');
    expect(openButton?.disabled).toBe(false);

    act(() => openButton?.click());
    expect(container.querySelector('[data-testid="batch-dialog"]')?.textContent).toBe(
      'original:download_allowed',
    );

    act(() => root.unmount());
    container.remove();
  });
});
