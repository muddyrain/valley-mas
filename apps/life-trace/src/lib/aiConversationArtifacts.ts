import type { RecipeSuggestionResponse } from '@/api/advice';
import type { AdvicePayload } from '@/types';

const AI_CONVERSATION_ARTIFACTS_KEY = 'life-trace.ai-conversation-artifacts.v1';

export type AiConversationArtifact = {
  result?: {
    title: string;
    detail: string;
    tone: 'ai' | 'plan' | 'trace' | 'health' | 'alert';
  } | null;
  recipeResult?: RecipeSuggestionResponse | null;
  adviceCards?: AdvicePayload[];
};

type ArtifactMap = Record<string, AiConversationArtifact>;

function readArtifactMap(): ArtifactMap {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(AI_CONVERSATION_ARTIFACTS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as ArtifactMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readAiConversationArtifact(conversationId: string): AiConversationArtifact | null {
  if (!conversationId) {
    return null;
  }
  return readArtifactMap()[conversationId] ?? null;
}

export function writeAiConversationArtifact(
  conversationId: string,
  artifact: AiConversationArtifact,
) {
  if (typeof window === 'undefined' || !conversationId) {
    return;
  }

  const map = readArtifactMap();
  map[conversationId] = artifact;
  window.localStorage.setItem(AI_CONVERSATION_ARTIFACTS_KEY, JSON.stringify(map));
}
