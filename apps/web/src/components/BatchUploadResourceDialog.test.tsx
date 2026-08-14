/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ai/ModelPicker', () => ({
  ModelPicker: () => <div>视觉模型</div>,
}));
vi.mock('@/api/resource', () => ({
  aiSuggestResourceTags: vi.fn(),
  suggestResourceTitle: vi.fn(),
  updateResource: vi.fn(),
  uploadResource: vi.fn(),
}));
vi.mock('@/utils/resourceUpload', () => ({
  confirmUploadResult: vi.fn(),
  createUploadKey: () => 'upload-key',
  shouldConfirmUploadResult: () => false,
  uploadConfirmingMessage: '确认中',
}));

import BatchUploadResourceDialog from './BatchUploadResourceDialog';

describe('BatchUploadResourceDialog', () => {
  it('keeps the confirmed batch provenance visible while selecting files', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        <BatchUploadResourceDialog
          open
          onOpenChange={() => undefined}
          policy={{
            sourceKind: 'licensed',
            sourceUrl: 'https://example.com/source',
            license: 'preview_only',
          }}
        />,
      );
    });

    expect(document.body.textContent).toContain('授权收藏');
    expect(document.body.textContent).toContain('仅预览并链接出处');

    act(() => root.unmount());
    container.remove();
  });
});
