import { useCallback } from 'react';
import {
  type LifeAssistantActionEvent,
  type LifeAssistantMessage,
  streamLifeAssistant,
} from '@/api/assistant';

type LifeAssistantStreamArgs = {
  message: string;
  history: LifeAssistantMessage[];
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onMeta?: (meta: { source?: 'ark' | 'openai'; model?: string }) => void;
  onAction?: (event: LifeAssistantActionEvent) => void;
};

type UseLifeAssistantStreamOptions = {
  token?: string;
  householdId?: string;
};

export function useLifeAssistantStream({ token, householdId }: UseLifeAssistantStreamOptions) {
  const stream = useCallback(
    async ({ message, history, signal, onChunk, onMeta, onAction }: LifeAssistantStreamArgs) => {
      if (!token) {
        throw new Error('请先登录');
      }

      await streamLifeAssistant(token, {
        message,
        history,
        signal,
        householdId,
        onChunk,
        onMeta,
        onAction,
      });
    },
    [householdId, token],
  );

  return { stream };
}
