import { describe, expect, it } from 'vitest';
import {
  getImageConversationMessageContent,
  getImageConversationReferenceAttachments,
  INITIAL_IMAGE_CONVERSATION_MESSAGE,
  REFERENCE_IMAGE_CONVERSATION_MESSAGE,
  RETRY_IMAGE_CONVERSATION_MESSAGE,
} from './conversationMessages';

describe('getImageConversationMessageContent', () => {
  it.each([
    {
      name: 'keeps the submitted text while the initial generation is queued',
      content: INITIAL_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'queued', stage: 'preparing' },
      expected: INITIAL_IMAGE_CONVERSATION_MESSAGE,
    },
    {
      name: 'reports that the generated image is being stored',
      content: INITIAL_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'running', stage: 'storing' },
      expected: '图片已生成，正在保存结果。',
    },
    {
      name: 'reports a successful initial generation',
      content: INITIAL_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'succeeded', stage: 'completed' },
      expected: '图片已生成。',
    },
    {
      name: 'reports a successful reference generation',
      content: REFERENCE_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'succeeded', stage: 'completed' },
      expected: '已基于参考图生成新的版本。',
    },
    {
      name: 'reports a successful retry',
      content: RETRY_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'succeeded', stage: 'completed' },
      expected: '图片已重新生成。',
    },
    {
      name: 'reports a failed initial generation',
      content: INITIAL_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'failed', stage: 'generating' },
      expected: '图片生成失败。',
    },
    {
      name: 'reports a failed retry',
      content: RETRY_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'failed', stage: 'generating' },
      expected: '重新生成失败。',
    },
    {
      name: 'reports a paused initial generation',
      content: INITIAL_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'paused', stage: 'generating' },
      expected: '图片生成已暂停。',
    },
    {
      name: 'reports a paused retry',
      content: RETRY_IMAGE_CONVERSATION_MESSAGE,
      generation: { status: 'paused', stage: 'generating' },
      expected: '已暂停重新生成。',
    },
  ] as const)('$name', ({ content, generation, expected }) => {
    expect(
      getImageConversationMessageContent(
        {
          id: 'assistant-1',
          role: 'assistant',
          content,
          generationId: 'generation-1',
        },
        generation,
      ),
    ).toBe(expected);
  });

  it('does not rewrite user messages', () => {
    expect(
      getImageConversationMessageContent(
        { id: 'user-1', role: 'user', content: '生成一张壁纸' },
        { status: 'succeeded', stage: 'completed' },
      ),
    ).toBe('生成一张壁纸');
  });
});

describe('getImageConversationReferenceAttachments', () => {
  it('restores the persisted reference preview on the user message before a generation', () => {
    const attachments = getImageConversationReferenceAttachments(
      [
        { id: 'user-1', role: 'user', content: '生成壁纸' },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: '生成中',
          generationId: 'generation-1',
        },
      ],
      0,
      [
        {
          id: 'generation-1',
          referenceCount: 2,
          canvasSnapshotUrl: '/snapshots/reference.png',
        },
      ],
    );

    expect(attachments).toEqual([
      expect.objectContaining({
        id: 'generation-reference-generation-1',
        name: '参考图',
        previewUrl: '/snapshots/reference.png',
        secondary: '共 2 张',
      }),
    ]);
  });

  it('prefers all local pasted references while the current conversation remains open', () => {
    const attachments = getImageConversationReferenceAttachments(
      [
        {
          id: 'user-1',
          role: 'user',
          content: '生成壁纸',
          referenceImages: [
            {
              id: 'reference-1',
              name: 'first.png',
              dataUrl: 'data:image/png;base64,AAAA',
              mimeType: 'image/png',
              sizeBytes: 4,
            },
            {
              id: 'reference-2',
              name: 'second.png',
              dataUrl: 'data:image/png;base64,BBBB',
              mimeType: 'image/png',
              sizeBytes: 4,
            },
          ],
        },
      ],
      0,
      [],
    );

    expect(attachments).toHaveLength(2);
    expect(attachments.map((attachment) => attachment.name)).toEqual(['first.png', 'second.png']);
  });
});
