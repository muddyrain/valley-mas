import type { Visibility } from '@/api/blog';

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
}

export interface StudioArticleDraft {
  title: string;
  content: string;
  excerpt: string;
  groupId: string;
  visibility: Visibility;
  cover: string;
  savedAt: number;
}

const draftKey = (userId: string, scope: string) => `yuji-studio-article:${userId}:${scope}`;

export function readStudioArticleDraft(storage: DraftStorage, userId: string, scope: string) {
  try {
    const raw = storage.getItem(draftKey(userId, scope));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StudioArticleDraft>;
    if (typeof value.title !== 'string' || typeof value.content !== 'string') return null;
    return {
      title: value.title,
      content: value.content,
      excerpt: typeof value.excerpt === 'string' ? value.excerpt : '',
      groupId: typeof value.groupId === 'string' ? value.groupId : '',
      visibility:
        value.visibility === 'private' || value.visibility === 'shared'
          ? value.visibility
          : 'public',
      cover: typeof value.cover === 'string' ? value.cover : '',
      savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
    } satisfies StudioArticleDraft;
  } catch {
    return null;
  }
}

export function writeStudioArticleDraft(
  storage: DraftStorage,
  userId: string,
  scope: string,
  draft: StudioArticleDraft,
) {
  storage.setItem(draftKey(userId, scope), JSON.stringify(draft));
}

export function clearStudioArticleDraft(storage: DraftStorage, userId: string, scope: string) {
  storage.removeItem(draftKey(userId, scope));
}
