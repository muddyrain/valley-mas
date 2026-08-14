import { describe, expect, it } from 'vitest';
import {
  getBatchResourceWorkspaceKey,
  normalizeBatchResourceWorkspace,
} from './batchResourceWorkspace';

describe('batch resource workspace', () => {
  it('isolates persisted selections by owner', () => {
    expect(getBatchResourceWorkspaceKey('user-1')).not.toBe(getBatchResourceWorkspaceKey('user-2'));
  });

  it('restores interrupted work as pending while preserving order and AI cache', () => {
    const first = new File(['first'], 'first.png', { type: 'image/png' });
    const second = new File(['second'], 'second.png', { type: 'image/png' });
    const restored = normalizeBatchResourceWorkspace({
      version: 1,
      uploadType: 'wallpaper',
      visibility: 'public',
      visionModelId: 'vision-1',
      updatedAt: 1,
      items: [
        {
          file: first,
          base64: 'data:first',
          uploadKey: 'first-key',
          title: '第一张',
          tags: ['春日'],
          status: 'running',
          aiMetadata: {
            title: '春日远行',
            tags: ['春日', '远行'],
            modelId: 'vision-1',
            resourceType: 'wallpaper',
            fileFingerprint: 'first.png:5:0',
          },
        },
        {
          file: second,
          base64: 'data:second',
          uploadKey: 'second-key',
          title: '第二张',
          tags: [],
          status: 'error',
          error: '上传失败',
        },
      ],
    });

    expect(restored?.items.map((item) => item.uploadKey)).toEqual(['first-key', 'second-key']);
    expect(restored?.items[0].status).toBe('pending');
    expect(restored?.items[0].aiMetadata?.tags).toEqual(['春日', '远行']);
    expect(restored?.items[1].status).toBe('error');
  });
});
