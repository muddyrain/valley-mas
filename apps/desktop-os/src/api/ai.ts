import { apiRequest } from './client';

export type AIChatRole = 'user' | 'assistant';

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
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
