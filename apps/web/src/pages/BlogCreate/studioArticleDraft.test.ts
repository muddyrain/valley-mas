import { describe, expect, it } from 'vitest';
import {
  clearStudioArticleDraft,
  readStudioArticleDraft,
  writeStudioArticleDraft,
} from './studioArticleDraft';

describe('studioArticleDraft', () => {
  it('keeps automatic drafts scoped to the owner and editor', () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    };
    writeStudioArticleDraft(adapter, 'owner-1', 'new', {
      title: '自动保存文章',
      content: '正文',
      excerpt: '',
      groupId: 'react',
      visibility: 'public',
      cover: '',
      savedAt: 100,
    });

    expect(readStudioArticleDraft(adapter, 'owner-1', 'new')?.title).toBe('自动保存文章');
    expect(readStudioArticleDraft(adapter, 'owner-2', 'new')).toBeNull();
    clearStudioArticleDraft(adapter, 'owner-1', 'new');
    expect(readStudioArticleDraft(adapter, 'owner-1', 'new')).toBeNull();
  });
});
