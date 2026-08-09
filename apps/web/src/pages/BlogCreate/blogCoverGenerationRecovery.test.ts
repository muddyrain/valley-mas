import { describe, expect, it } from 'vitest';
import {
  clearBlogCoverGenerationRecovery,
  readBlogCoverGenerationRecovery,
  writeBlogCoverGenerationRecovery,
} from './blogCoverGenerationRecovery';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe('blog cover generation recovery', () => {
  it('restores the durable generation id for the same owner and article', () => {
    const storage = new MemoryStorage();
    writeBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', {
      generationId: 'generation-42',
      createdAt: 1_000,
    });

    expect(readBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', 2_000)).toEqual({
      generationId: 'generation-42',
      createdAt: 1_000,
    });
    expect(readBlogCoverGenerationRecovery(storage, 'user-1', 'post-9', 2_000)).toBeNull();
  });

  it('clears the pointer after the cover is saved or deliberately replaced', () => {
    const storage = new MemoryStorage();
    writeBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', {
      generationId: 'generation-42',
      createdAt: 1_000,
    });

    clearBlogCoverGenerationRecovery(storage, 'user-1', 'post-8');

    expect(readBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', 2_000)).toBeNull();
  });

  it('keeps an unsaved result discoverable until the user saves or replaces it', () => {
    const storage = new MemoryStorage();
    writeBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', {
      generationId: 'generation-42',
      createdAt: 1_000,
    });

    expect(
      readBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', 8 * 24 * 60 * 60 * 1_000),
    ).toEqual({ generationId: 'generation-42', createdAt: 1_000 });
  });

  it('drops malformed pointers instead of blocking the editor', () => {
    const storage = new MemoryStorage();

    storage.setItem('valley.blog-cover-generation.v1:user-1:post-8', '{broken');
    expect(readBlogCoverGenerationRecovery(storage, 'user-1', 'post-8', 2_000)).toBeNull();
  });

  it('does not interrupt a paid generation when browser storage is unavailable', () => {
    const unavailableStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {
        throw new Error('storage unavailable');
      },
      removeItem: () => {
        throw new Error('storage unavailable');
      },
    };

    expect(() =>
      writeBlogCoverGenerationRecovery(unavailableStorage, 'user-1', 'post-8', {
        generationId: 'generation-42',
        createdAt: 1_000,
      }),
    ).not.toThrow();
    expect(
      readBlogCoverGenerationRecovery(unavailableStorage, 'user-1', 'post-8', 2_000),
    ).toBeNull();
    expect(() =>
      clearBlogCoverGenerationRecovery(unavailableStorage, 'user-1', 'post-8'),
    ).not.toThrow();
  });
});
