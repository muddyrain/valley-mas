import type { DebateMessage, DebateSSEEvent } from './types';

export function parseDebateSSEEvent(event: MessageEvent<string>): DebateSSEEvent | null {
  if (!event.data) return null;

  try {
    return JSON.parse(event.data) as DebateSSEEvent;
  } catch {
    return null;
  }
}

export function buildMessageFromSSEEvent(
  payload: DebateSSEEvent,
  fallbackIndex: number,
): DebateMessage | null {
  if (!payload.personaId || !payload.personaName || !payload.content) {
    return null;
  }

  const round = payload.round || 1;
  return {
    id: `${payload.personaId}-${round}-${fallbackIndex}`,
    round,
    roundTitle: payload.roundTitle || '立场表达',
    personaId: payload.personaId,
    personaName: payload.personaName,
    content: payload.content,
    createdAt: new Date().toISOString(),
  };
}

export function appendUniqueDebateMessage(
  messages: DebateMessage[],
  incoming: DebateMessage,
): DebateMessage[] {
  const exists = messages.some(
    (message) =>
      message.round === incoming.round &&
      message.personaId === incoming.personaId &&
      message.content === incoming.content,
  );
  if (exists) return messages;
  return [...messages, incoming];
}
