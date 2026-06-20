import type { AIChatMessage } from '../api/ai';

export const AI_COMMAND_HISTORY_STORAGE_KEY = 'desktop-os-ai-command-history-v1';
const AI_COMMAND_HISTORY_VERSION = 1;
const MAX_CONVERSATIONS = 24;
const MAX_TITLE_LENGTH = 28;

export interface AICommandMessage extends AIChatMessage {
  id: string;
  createdAt: string;
}

export interface AICommandConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AICommandMessage[];
}

export interface AICommandHistoryState {
  activeConversationId: string;
  conversations: AICommandConversation[];
}

interface StoredAICommandHistoryState extends AICommandHistoryState {
  version: number;
}

function createId(prefix: string) {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function nowISO() {
  return new Date().toISOString();
}

export function deriveAICommandTitle(input: string) {
  const firstLine = input
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return '新对话';
  return firstLine.length > MAX_TITLE_LENGTH
    ? `${firstLine.slice(0, MAX_TITLE_LENGTH - 1)}…`
    : firstLine;
}

export function createAICommandMessage(
  role: AICommandMessage['role'],
  content: string,
): AICommandMessage {
  return {
    id: createId(role),
    role,
    content,
    createdAt: nowISO(),
  };
}

export function createAICommandConversation(title = '新对话'): AICommandConversation {
  const createdAt = nowISO();
  return {
    id: createId('conversation'),
    title,
    createdAt,
    updatedAt: createdAt,
    messages: [],
  };
}

export function ensureAICommandHistory(value: AICommandHistoryState | null): AICommandHistoryState {
  const validConversations =
    value?.conversations.filter((conversation) => isAICommandConversation(conversation)) ?? [];
  if (validConversations.length === 0) {
    const conversation = createAICommandConversation();
    return {
      activeConversationId: conversation.id,
      conversations: [conversation],
    };
  }

  const firstConversation = validConversations[0];
  const activeConversationId =
    typeof value?.activeConversationId === 'string' &&
    validConversations.some((conversation) => conversation.id === value.activeConversationId)
      ? value.activeConversationId
      : firstConversation.id;

  return {
    activeConversationId,
    conversations: validConversations.slice(0, MAX_CONVERSATIONS),
  };
}

export function readAICommandHistory(
  storage: Pick<Storage, 'getItem'> = window.localStorage,
): AICommandHistoryState {
  try {
    const raw = storage.getItem(AI_COMMAND_HISTORY_STORAGE_KEY);
    if (!raw) return ensureAICommandHistory(null);
    const value = JSON.parse(raw) as Partial<StoredAICommandHistoryState>;
    return ensureAICommandHistory({
      activeConversationId:
        typeof value.activeConversationId === 'string' ? value.activeConversationId : '',
      conversations: Array.isArray(value.conversations) ? value.conversations : [],
    });
  } catch {
    return ensureAICommandHistory(null);
  }
}

export function writeAICommandHistory(
  state: AICommandHistoryState,
  storage: Pick<Storage, 'setItem'> = window.localStorage,
) {
  const normalized = ensureAICommandHistory(state);
  const payload: StoredAICommandHistoryState = {
    version: AI_COMMAND_HISTORY_VERSION,
    ...normalized,
  };
  storage.setItem(AI_COMMAND_HISTORY_STORAGE_KEY, JSON.stringify(payload));
}

export function upsertAICommandConversation(
  state: AICommandHistoryState,
  conversation: AICommandConversation,
): AICommandHistoryState {
  const conversations = [
    conversation,
    ...state.conversations.filter((item) => item.id !== conversation.id),
  ].slice(0, MAX_CONVERSATIONS);
  return ensureAICommandHistory({
    activeConversationId: state.activeConversationId || conversation.id,
    conversations,
  });
}

export function setActiveAICommandConversation(
  state: AICommandHistoryState,
  conversationId: string,
): AICommandHistoryState {
  return ensureAICommandHistory({
    activeConversationId: conversationId,
    conversations: state.conversations,
  });
}

export function deleteAICommandConversation(
  state: AICommandHistoryState,
  conversationId: string,
): AICommandHistoryState {
  const remaining = state.conversations.filter((item) => item.id !== conversationId);
  if (remaining.length === 0) {
    return ensureAICommandHistory(null);
  }

  const activeConversationId =
    state.activeConversationId === conversationId ? remaining[0].id : state.activeConversationId;
  return ensureAICommandHistory({
    activeConversationId,
    conversations: remaining,
  });
}

function isAICommandConversation(value: unknown): value is AICommandConversation {
  if (!value || typeof value !== 'object') return false;
  const conversation = value as Partial<AICommandConversation>;
  return (
    typeof conversation.id === 'string' &&
    typeof conversation.title === 'string' &&
    typeof conversation.createdAt === 'string' &&
    typeof conversation.updatedAt === 'string' &&
    Array.isArray(conversation.messages)
  );
}
