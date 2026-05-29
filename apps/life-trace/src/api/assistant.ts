import { API_BASE, apiRequest } from '@/api/request';

export type LifeAssistantMessage = {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
};

export type LifeAssistantConversation = {
  id: string;
  title: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LifeAssistantConversationResponse = {
  conversation: LifeAssistantConversation;
  messages: LifeAssistantMessage[];
};

type AssistantStreamChunk = {
  chunk?: string;
  done?: boolean;
  error?: string;
  source?: 'ark' | 'openai';
  model?: string;
};

type StreamOptions = {
  message: string;
  history: LifeAssistantMessage[];
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onMeta?: (meta: { source?: 'ark' | 'openai'; model?: string }) => void;
};

export async function streamLifeAssistant(token: string, options: StreamOptions) {
  const response = await fetch(`${API_BASE}/life-trace/ai/assistant/stream`, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    signal: options.signal,
    body: JSON.stringify({
      message: options.message,
      history: options.history.slice(-6),
    }),
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }
  if (!response.body) {
    throw new Error('当前浏览器不支持流式响应');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleEvent = (eventText: string) => {
    const dataLines = eventText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());

    for (const data of dataLines) {
      if (!data || data === '[DONE]') {
        continue;
      }

      const payload = JSON.parse(data) as AssistantStreamChunk;
      if (payload.error) {
        throw new Error(payload.error);
      }
      if (payload.source || payload.model) {
        options.onMeta?.({ source: payload.source, model: payload.model });
      }
      if (payload.chunk) {
        options.onChunk(payload.chunk);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });

    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const eventText of events) {
      handleEvent(eventText);
    }

    if (done) {
      break;
    }
  }

  if (buffer.trim()) {
    handleEvent(buffer);
  }
}

export function getLifeAssistantConversation(token: string) {
  return apiRequest<LifeAssistantConversationResponse>('/life-trace/ai/conversation', token, {
    method: 'GET',
  });
}

export function saveLifeAssistantMessage(
  token: string,
  message: Pick<LifeAssistantMessage, 'role' | 'content'>,
) {
  return apiRequest<LifeAssistantMessage>('/life-trace/ai/conversation/messages', token, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export function clearLifeAssistantConversation(token: string) {
  return apiRequest<{ conversationId: string }>('/life-trace/ai/conversation', token, {
    method: 'DELETE',
  });
}
