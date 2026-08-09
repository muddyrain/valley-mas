import { beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock('@/utils/request', () => ({
  default: { post: postMock },
}));

import { uploadAIAppConversationAttachment } from './aiWorkbench';

describe('uploadAIAppConversationAttachment', () => {
  beforeEach(() => {
    postMock.mockReset();
    postMock.mockResolvedValue({ attachment: { id: 'attachment-1' } });
  });

  it.each([
    ['document.pdf', 'application/pdf'],
    ['notes.md', 'text/markdown'],
    ['reference.png', 'image/png'],
  ])('reports measured upload progress for %s', async (name, type) => {
    const file = new File([new Uint8Array(100)], name, { type });
    const onProgress = vi.fn();

    await uploadAIAppConversationAttachment('app-1', 'conversation-1', file, onProgress);

    const [url, body, config] = postMock.mock.calls[0];
    expect(url).toBe('/ai/apps/app-1/conversations/conversation-1/attachments');
    expect(body).toBeInstanceOf(FormData);

    config.onUploadProgress({ loaded: 37, total: 100, progress: 0.37 });
    expect(onProgress).toHaveBeenCalledWith(37);
  });
});
