import { ApiError, apiRequest, getApiBaseUrl } from './client';

export type AIChatRole = 'user' | 'assistant';

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  avatarIcon: string;
  systemPrompt: string;
  openingMessage: string;
  exampleQuestions: string[];
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AIConversation {
  id: string;
  agentId: string;
  title: string;
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: string;
  agentId: string;
  conversationId: string;
  role: AIChatRole;
  content: string;
  createdAt: string;
}

export interface AIChatRequest {
  message: string;
  history?: AIChatMessage[];
  stream?: boolean;
}

export interface AIChatResponse {
  reply: string;
  model: string;
  provider?: string;
}

export type AIAgentInput = Partial<
  Pick<
    AIAgent,
    | 'name'
    | 'description'
    | 'avatarColor'
    | 'avatarIcon'
    | 'systemPrompt'
    | 'openingMessage'
    | 'exampleQuestions'
    | 'status'
  >
>;

export interface AIAgentListResponse {
  agents: AIAgent[];
  activeAgentId: string;
}

export interface AIAgentResponse {
  agent: AIAgent;
}

export interface AIConversationListResponse {
  conversations: AIConversation[];
}

export interface AIConversationResponse {
  conversation: AIConversation;
  messages?: AIMessage[];
}

export interface AIAgentChatResponse {
  conversation: AIConversation;
  userMessage: AIMessage;
  assistantMessage: AIMessage;
  reply: string;
  model: string;
  provider: 'ark';
}

export type AIAgentChatStreamEvent =
  | {
      type: 'meta';
      conversation: AIConversation;
      userMessage: AIMessage;
      model: string;
      provider: 'ark';
    }
  | {
      type: 'delta';
      chunk: string;
      model: string;
    }
  | {
      type: 'done';
      conversation: AIConversation;
      assistantMessage: AIMessage;
      reply: string;
      model: string;
      provider: 'ark';
    }
  | {
      type: 'error';
      message: string;
    };

export interface AIAgentChatStreamHandlers {
  onMeta?: (event: Extract<AIAgentChatStreamEvent, { type: 'meta' }>) => void;
  onDelta?: (event: Extract<AIAgentChatStreamEvent, { type: 'delta' }>) => void;
  onDone?: (event: Extract<AIAgentChatStreamEvent, { type: 'done' }>) => void;
}

export function postAIChat(input: AIChatRequest, token: string) {
  return apiRequest<AIChatResponse>('/ai/chat', {
    method: 'POST',
    token,
    body: {
      ...input,
      stream: false,
    },
  });
}

export function listAIAgents(token: string) {
  return apiRequest<AIAgentListResponse>('/ai/agents', { token });
}

export function createAIAgent(input: AIAgentInput, token: string) {
  return apiRequest<AIAgentResponse>('/ai/agents', {
    method: 'POST',
    token,
    body: input,
  });
}

export function getAIAgent(agentId: string, token: string) {
  return apiRequest<AIAgentResponse>(`/ai/agents/${agentId}`, { token });
}

export function updateAIAgent(agentId: string, input: AIAgentInput, token: string) {
  return apiRequest<AIAgentResponse>(`/ai/agents/${agentId}`, {
    method: 'PATCH',
    token,
    body: input,
  });
}

export function deleteAIAgent(agentId: string, token: string) {
  return apiRequest<{ deletedId: string; nextAgentId: string }>(`/ai/agents/${agentId}`, {
    method: 'DELETE',
    token,
  });
}

export function listAIConversations(agentId: string, token: string) {
  return apiRequest<AIConversationListResponse>(`/ai/agents/${agentId}/conversations`, {
    token,
  });
}

export function createAIConversation(agentId: string, input: { title?: string }, token: string) {
  return apiRequest<AIConversationResponse>(`/ai/agents/${agentId}/conversations`, {
    method: 'POST',
    token,
    body: input,
  });
}

export function getAIConversation(agentId: string, conversationId: string, token: string) {
  return apiRequest<AIConversationResponse>(
    `/ai/agents/${agentId}/conversations/${conversationId}`,
    { token },
  );
}

export function deleteAIConversation(agentId: string, conversationId: string, token: string) {
  return apiRequest<{ deletedId: string }>(
    `/ai/agents/${agentId}/conversations/${conversationId}`,
    {
      method: 'DELETE',
      token,
    },
  );
}

export function postAIAgentChat(
  agentId: string,
  conversationId: string,
  input: { message: string },
  token: string,
) {
  return apiRequest<AIAgentChatResponse>(
    `/ai/agents/${agentId}/conversations/${conversationId}/chat`,
    {
      method: 'POST',
      token,
      body: input,
    },
  );
}

export async function streamAIAgentChat(
  agentId: string,
  conversationId: string,
  input: { message: string },
  token: string,
  handlers: AIAgentChatStreamHandlers,
) {
  let response: Response;
  try {
    response = await fetch(
      `${getApiBaseUrl()}/ai/agents/${agentId}/conversations/${conversationId}/chat`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ...input, stream: true }),
      },
    );
  } catch {
    throw new ApiError('无法连接到服务器');
  }

  if (!response.ok) {
    let message = 'AI 请求失败';
    try {
      const payload = (await response.json()) as { message?: string };
      message = payload.message || message;
    } catch {
      // keep fallback
    }
    throw new ApiError(message, response.status);
  }
  if (!response.body) throw new ApiError('浏览器不支持流式响应');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeEvent = (raw: string) => {
    const dataLine = raw
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.startsWith('data:'));
    if (!dataLine) return;
    const payload = JSON.parse(dataLine.slice(5).trim()) as AIAgentChatStreamEvent;
    if (payload.type === 'meta') handlers.onMeta?.(payload);
    if (payload.type === 'delta') handlers.onDelta?.(payload);
    if (payload.type === 'done') handlers.onDone?.(payload);
    if (payload.type === 'error') throw new ApiError(payload.message || 'AI 请求失败');
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';
    for (const event of events) {
      if (event.trim()) consumeEvent(event);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) consumeEvent(buffer);
}
