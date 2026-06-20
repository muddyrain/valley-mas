import { describe, expect, it } from 'vitest';
import {
  createAICommandConversation,
  createAICommandMessage,
  deleteAICommandConversation,
  deriveAICommandTitle,
  ensureAICommandHistory,
  upsertAICommandConversation,
} from '../src/apps/aiCommandCenterHistory';

describe('AI Command Center history model', () => {
  it('creates a default conversation when history is empty', () => {
    const state = ensureAICommandHistory(null);

    expect(state.conversations).toHaveLength(1);
    expect(state.activeConversationId).toBe(state.conversations[0].id);
    expect(state.conversations[0].title).toBe('新对话');
  });

  it('derives stable conversation titles from the first user message', () => {
    expect(deriveAICommandTitle('  帮我总结这篇文章\n第二行  ')).toBe('帮我总结这篇文章');
    expect(deriveAICommandTitle('')).toBe('新对话');
  });

  it('upserts conversations to the top and preserves the active conversation', () => {
    const first = createAICommandConversation('第一段');
    const second = createAICommandConversation('第二段');
    const updatedFirst = {
      ...first,
      messages: [createAICommandMessage('user', 'hello')],
    };

    const state = upsertAICommandConversation(
      { activeConversationId: second.id, conversations: [second, first] },
      updatedFirst,
    );

    expect(state.conversations[0]).toBe(updatedFirst);
    expect(state.activeConversationId).toBe(second.id);
  });

  it('keeps one empty conversation after deleting the last record', () => {
    const only = createAICommandConversation('只剩一个');
    const state = deleteAICommandConversation(
      { activeConversationId: only.id, conversations: [only] },
      only.id,
    );

    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].messages).toEqual([]);
    expect(state.activeConversationId).toBe(state.conversations[0].id);
  });
});
