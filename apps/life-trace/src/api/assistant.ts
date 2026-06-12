import { API_BASE, apiRequest } from '@/api/request';
import type { LedgerEntry, PantryItem, Plan } from '@/types';

export type LifeAssistantMessage = {
  id?: string;
  conversationId?: string;
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

export type LifeAssistantConversationsResponse = {
  activeConversationId: string;
  list: LifeAssistantConversation[];
};

export type AssistantStreamChunk = {
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
  householdName?: string;
  pantryItem?: PantryItem;
};

export type LifeAssistantLedgerEvent = LifeAssistantActionBase & {
  type: 'create_ledger_entry';
  ledgerEntry?: LedgerEntry;
};

export interface LifeAssistantActionEventMap {
  create_plan: LifeAssistantPlanEvent;
  create_pantry_item: LifeAssistantPantryEvent;
  create_ledger_entry: LifeAssistantLedgerEvent;
}

export type LifeAssistantActionEvent =
  LifeAssistantActionEventMap[keyof LifeAssistantActionEventMap];

export type LifeAssistantActionType = keyof LifeAssistantActionEventMap | (string & {});

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

export function listLifeAssistantConversations(token: string) {
  return apiRequest<LifeAssistantConversationsResponse>('/life-trace/ai/conversations', token, {
    method: 'GET',
  });
}

export function createLifeAssistantConversation(token: string, title = '新话题') {
  return apiRequest<LifeAssistantConversation>('/life-trace/ai/conversations', token, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export function getLifeAssistantConversationById(token: string, conversationId: string) {
  return apiRequest<LifeAssistantConversationResponse>(
    `/life-trace/ai/conversations/${encodeURIComponent(conversationId)}`,
    token,
    {
      method: 'GET',
    },
  );
}

export function saveLifeAssistantMessage(
  token: string,
  message: Pick<LifeAssistantMessage, 'role' | 'content'>,
  conversationId?: string,
) {
  const path = conversationId
    ? `/life-trace/ai/conversations/${encodeURIComponent(conversationId)}/messages`
    : '/life-trace/ai/conversation/messages';
  return apiRequest<LifeAssistantMessage>(path, token, {
    method: 'POST',
    body: JSON.stringify(message),
  });
}

export function clearLifeAssistantConversation(token: string, conversationId?: string) {
  const path = conversationId
    ? `/life-trace/ai/conversations/${encodeURIComponent(conversationId)}`
    : '/life-trace/ai/conversation';
  return apiRequest<{ conversationId?: string; deletedId?: string; nextConversationId?: string }>(
    path,
    token,
    {
      method: 'DELETE',
    },
  );
}

export function deleteLifeAssistantConversation(token: string, conversationId: string) {
  return apiRequest<{ deletedId: string; nextConversationId: string }>(
    `/life-trace/ai/conversations/${encodeURIComponent(conversationId)}`,
    token,
    {
      method: 'DELETE',
    },
  );
}
