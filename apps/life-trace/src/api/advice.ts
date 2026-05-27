import { apiRequest } from '@/api/request';
import type { AdvicePayload } from '@/types';

export type TodayAdviceResponse = {
  summary: string;
  list: AdvicePayload[];
  source: 'ark' | 'openai';
  model?: string;
};

const TODAY_ADVICE_TIMEOUT_MS = 35000;

export function generateTodayAdvice(token: string, options: { signal?: AbortSignal } = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), TODAY_ADVICE_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<TodayAdviceResponse>('/life-trace/ai/today-advice', token, {
    method: 'POST',
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}
