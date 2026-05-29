import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearLifeAssistantConversation,
  getLifeAssistantConversation,
  saveLifeAssistantMessage,
} from '../src/api/assistant';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('assistant api', () => {
  it('loads persisted assistant messages with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          conversation: { id: 'conversation-1', title: '生活助理对话', status: 'active' },
          messages: [{ id: 'message-1', role: 'user', content: '明天中午吃饭' }],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await getLifeAssistantConversation(token);

    expect(data.messages[0].content).toBe('明天中午吃饭');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/ai/conversation',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('saves assistant messages through the backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { id: 'message-1', role: 'assistant', content: '已帮你安排。' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await saveLifeAssistantMessage(token, {
      role: 'assistant',
      content: '已帮你安排。',
    });

    expect(data.id).toBe('message-1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/ai/conversation/messages',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        headers: expect.any(Headers),
        body: JSON.stringify({ role: 'assistant', content: '已帮你安排。' }),
      }),
    );
  });

  it('clears the current assistant conversation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { conversationId: 'conversation-1' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await clearLifeAssistantConversation(token);

    expect(data.conversationId).toBe('conversation-1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/ai/conversation');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});
