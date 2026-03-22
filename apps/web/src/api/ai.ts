import { useAuthStore } from '@/stores/useAuthStore';
import http from '@/utils/request';

export interface AIChatMessage {
  role: 'user' | 'assistant';
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
}

export interface AIStreamChunk {
  chunk?: string;
  done?: boolean;
  model?: string;
  error?: string;
}

export const reqAIChat = (data: AIChatRequest) => {
  return http.post<unknown, AIChatResponse>('/ai/chat', data, {
    timeout: 60000,
  });
};

export const reqAIChatStream = async (
  data: AIChatRequest,
  handlers: {
    onChunk: (payload: AIStreamChunk) => void;
    onError?: (message: string) => void;
  },
) => {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const token = useAuthStore.getState().token;

  const res = await fetch(`${baseURL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...data, stream: true }),
    credentials: 'include',
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `stream request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const evt of events) {
      const line = evt
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s.startsWith('data:'));
      if (!line) continue;

      const raw = line.slice(5).trim();
      if (!raw) continue;

      try {
        const payload = JSON.parse(raw) as AIStreamChunk;
        if (payload.error) {
          handlers.onError?.(payload.error);
          return;
        }
        handlers.onChunk(payload);
      } catch {
        // ignore invalid chunk
      }
    }
  }
};
