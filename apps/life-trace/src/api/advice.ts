import { apiRequest } from '@/api/request';
import type { AdvicePayload } from '@/types';

export type TodayAdviceResponse = {
  summary: string;
  list: AdvicePayload[];
  source: 'ark' | 'openai';
  model?: string;
};

export type WeeklyReviewResponse = {
  id: string;
  weekStart: string;
  weekEnd: string;
  summary: string;
  wins: string[];
  delays: string[];
  insights: string[];
  nextActions: string[];
  source: 'ark' | 'openai';
  model?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WeeklyReviewListResponse = {
  list: WeeklyReviewResponse[];
};

export type ImageAnalysisRequest = {
  imageUrl?: string;
  kind: string;
};

export type ImageAnalysisResponse = {
  title: string;
  summary: string;
  planType: '电影' | '吃饭' | '运动' | '阅读' | '聚会' | '普通事项';
  mood: string;
  tags: string[];
  schedule: {
    dateOption: '今天' | '明天' | '周五' | '周六' | '周日';
    time: string;
  };
  source: 'ark';
  model?: string;
};

export type RecipeSuggestionRequest = {
  meal?: '早餐' | '午餐' | '晚餐' | '加餐';
  servings?: number;
  maxMinutes?: number;
  householdId?: string;
};

export type RecipeSuggestionItem = {
  id: string;
  title: string;
  reason: string;
  usedItems: string[];
  missingItems: string[];
  timeMinutes: number;
  difficulty: '简单' | '中等';
  servings: number;
  steps: string[];
  tags: string[];
  planTitle: string;
  planNote: string;
};

export type RecipeSuggestionResponse = {
  summary: string;
  recipes: RecipeSuggestionItem[];
  warnings: string[];
  householdId?: string;
  householdName?: string;
  source: 'ark' | 'openai' | 'local';
  model?: string;
};

const TODAY_ADVICE_TIMEOUT_MS = 35000;
const WEEKLY_REVIEW_TIMEOUT_MS = 45000;
const IMAGE_ANALYSIS_TIMEOUT_MS = 45000;
const RECIPE_SUGGESTION_TIMEOUT_MS = 45000;

export function generateTodayAdvice(token: string, options: { signal?: AbortSignal } = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), TODAY_ADVICE_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<TodayAdviceResponse>('/life-trace/ai/today-advice', token, {
    method: 'POST',
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}

export function generateWeeklyReview(token: string, options: { signal?: AbortSignal } = {}) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), WEEKLY_REVIEW_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<WeeklyReviewResponse>('/life-trace/ai/weekly-review', token, {
    method: 'POST',
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}

export function listWeeklyReviews(token: string) {
  return apiRequest<WeeklyReviewListResponse>('/life-trace/weekly-reviews', token, {
    method: 'GET',
  });
}

export function deleteWeeklyReview(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/weekly-reviews/${id}`, token, {
    method: 'DELETE',
  });
}

export function analyzeImage(
  token: string,
  input: ImageAnalysisRequest,
  options: { signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), IMAGE_ANALYSIS_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<ImageAnalysisResponse>('/life-trace/ai/image-analysis', token, {
    method: 'POST',
    body: JSON.stringify(input),
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}

export function generateRecipeSuggestions(
  token: string,
  input: RecipeSuggestionRequest = {},
  options: { signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), RECIPE_SUGGESTION_TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  const query = input.householdId ? `?householdId=${encodeURIComponent(input.householdId)}` : '';
  return apiRequest<RecipeSuggestionResponse>(`/life-trace/ai/recipes${query}`, token, {
    method: 'POST',
    body: JSON.stringify({
      meal: input.meal,
      servings: input.servings,
      maxMinutes: input.maxMinutes,
    }),
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}

export type RecipeVideoResponse = {
  url: string;
  expiresAt: string;
};

export function renderRecipeVideo(
  token: string,
  input: { recipeId: string },
  options: { signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 120000); // 2分钟超时
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<RecipeVideoResponse>('/life-trace/ai/recipes/render-video', token, {
    method: 'POST',
    body: JSON.stringify({
      recipeId: input.recipeId,
    }),
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}
