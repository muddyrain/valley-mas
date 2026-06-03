import { API_BASE, apiRequest } from '@/api/request';
import type { PantryItem, Plan } from '@/types';

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
  action?: LifeAssistantActionEvent;
};

type LifeAssistantActionBase = {
  status: 'created' | 'exists' | 'error' | 'need_more_info';
  message: string;
  needMoreInfoFields?: string[];
};

export type LifeAssistantPlanEvent = LifeAssistantActionBase & {
  type: 'create_plan';
  plan?: Plan;
};

export type LifeAssistantPantryEvent = LifeAssistantActionBase & {
  type: 'create_pantry_item';
  pantryItem?: PantryItem;
};

export type LifeAssistantActionEvent = LifeAssistantPlanEvent | LifeAssistantPantryEvent;

type StreamOptions = {
  message: string;
  history: LifeAssistantMessage[];
  householdId?: string;
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onMeta?: (meta: { source?: 'ark' | 'openai'; model?: string }) => void;
  onAction?: (event: LifeAssistantActionEvent) => void;
};

export async function streamLifeAssistant(token: string, options: StreamOptions) {
  const query = options.householdId?.trim()
    ? `?householdId=${encodeURIComponent(options.householdId.trim())}`
    : '';
  const response = await fetch(`${API_BASE}/life-trace/ai/assistant/stream${query}`, {
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
      if (payload.action) {
        options.onAction?.(payload.action);
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
