/** @vitest-environment jsdom */

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  confirmUploadResult,
  shouldConfirmUploadResult,
  suggestResourceMetadata,
  updateResource,
  uploadResource,
  workspaceStore,
} = vi.hoisted(() => ({
  confirmUploadResult: vi.fn(),
  shouldConfirmUploadResult: vi.fn(),
  suggestResourceMetadata: vi.fn(),
  updateResource: vi.fn(),
  uploadResource: vi.fn(),
  workspaceStore: {
    load: vi.fn(),
    save: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('@/components/ai/ModelPicker', () => ({
  ModelPicker: ({ onValueChange }: { onValueChange: (value: string) => void }) => (
    <button type="button" onClick={() => onValueChange('vision-1')}>
      选择视觉模型
    </button>
  ),
}));
vi.mock('@/api/resource', () => ({
  suggestResourceMetadata,
  updateResource,
  uploadResource,
}));
vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'owner-1' } }),
}));
vi.mock('@/utils/batchResourceWorkspace', () => ({
  batchResourceWorkspaceStore: workspaceStore,
}));
vi.mock('@/utils/resourceUpload', () => ({
  confirmUploadResult,
  createUploadKey: () => 'upload-key',
  shouldConfirmUploadResult,
  uploadConfirmingMessage: '确认中',
}));

import BatchUploadResourceDialog from './BatchUploadResourceDialog';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  workspaceStore.load.mockResolvedValue(null);
  workspaceStore.save.mockResolvedValue(undefined);
  workspaceStore.clear.mockResolvedValue(undefined);
  shouldConfirmUploadResult.mockReturnValue(false);
  uploadResource.mockResolvedValue({ resource: { id: 'resource-1' } });
  updateResource.mockResolvedValue(undefined);
  suggestResourceMetadata.mockResolvedValue({
    title: '春日远行',
    tags: ['春日', '旅行'],
    model: 'vision-model',
    provider: 'test',
  });
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => 'blob:preview'),
    revokeObjectURL: vi.fn(),
  });
});

describe('BatchUploadResourceDialog', () => {
  it('keeps resource type, visibility and separate AI actions without provenance forms', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BatchUploadResourceDialog open onOpenChange={() => undefined} />);
    });

    expect(document.body.textContent).toContain('资源类型');
    expect(document.body.textContent).toContain('可见范围');
    expect(document.body.textContent).not.toContain('来源');
    expect(document.body.textContent).not.toContain('许可');

    act(() => root.unmount());
    container.remove();
  });

  it('restores unfinished items and reuses one AI result for separate title and tag actions', async () => {
    workspaceStore.load.mockResolvedValueOnce({
      version: 1,
      uploadType: 'wallpaper',
      visibility: 'public',
      visionModelId: '',
      updatedAt: 1,
      items: [
        {
          file: new File(['image'], 'spring.png', { type: 'image/png' }),
          base64: 'data:image/png;base64,aW1hZ2U=',
          uploadKey: 'spring-key',
          title: 'spring',
          tags: [],
          status: 'pending',
        },
      ],
    });
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BatchUploadResourceDialog open onOpenChange={() => undefined} />);
    });
    await flush();

    expect(
      document.body.querySelector<HTMLInputElement>('input[placeholder="资源名称"]')?.value,
    ).toBe('spring');
    const modelButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('选择视觉模型'),
    );
    act(() => modelButton?.click());

    const titleButton = document.body.querySelector<HTMLButtonElement>('button[title="AI 起名"]');
    await act(async () => {
      titleButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(
      document.body.querySelector<HTMLInputElement>('input[placeholder="资源名称"]')?.value,
    ).toBe('春日远行');

    const tagButton = document.body.querySelector<HTMLButtonElement>('button[title="AI 识别标签"]');
    await act(async () => {
      tagButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain('旅行');
    expect(suggestResourceMetadata).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });

  it('continues the batch when an earlier upload result is uncertain', async () => {
    workspaceStore.load.mockResolvedValueOnce({
      version: 1,
      uploadType: 'wallpaper',
      visibility: 'public',
      visionModelId: '',
      updatedAt: 1,
      items: [
        {
          file: new File(['first'], 'first.png', { type: 'image/png' }),
          base64: 'data:image/png;base64,Zmlyc3Q=',
          uploadKey: 'first-key',
          title: '第一张',
          tags: [],
          status: 'pending',
        },
        {
          file: new File(['second'], 'second.png', { type: 'image/png' }),
          base64: 'data:image/png;base64,c2Vjb25k',
          uploadKey: 'second-key',
          title: '第二张',
          tags: [],
          status: 'pending',
        },
      ],
    });
    shouldConfirmUploadResult.mockReturnValue(true);
    uploadResource
      .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
      .mockResolvedValueOnce({ resource: { id: 'resource-2' } });
    confirmUploadResult.mockReturnValueOnce(new Promise(() => undefined));

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<BatchUploadResourceDialog open onOpenChange={() => undefined} />);
    });
    await flush();

    const uploadButton = Array.from(document.body.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('开始批量上传'),
    );
    await act(async () => {
      uploadButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(uploadResource).toHaveBeenCalledTimes(2);
    expect(confirmUploadResult).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('上传未完成，可重试');
    expect(document.body.textContent).not.toContain('请稍后刷新资源列表确认');

    act(() => root.unmount());
    container.remove();
  });
});
