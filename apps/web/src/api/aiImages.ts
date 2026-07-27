import request from '@/utils/request';

export type AIImageGenerationStatus = 'queued' | 'running' | 'paused' | 'succeeded' | 'failed';
export type AIImageGenerationStage = 'preparing' | 'generating' | 'storing' | 'completed';

export interface AIImageRecipe {
  id: string;
  name: string;
  description: string;
  samplePrompts: string[];
  requiresReference: boolean;
  recommendedAspect: string;
}

export interface AIImageStyleProfile {
  id: string;
  name: string;
  description: string;
  source: 'builtin' | 'skill';
}

export interface AIImageCreationOptions {
  recipes: AIImageRecipe[];
  styleProfiles: AIImageStyleProfile[];
  aspectRatios: string[];
  qualities: string[];
  sizes: Record<string, Record<string, string>>;
}

export interface AIImageGeneration {
  id: string;
  modelCatalogId: string;
  provider: string;
  model: string;
  presetId: string;
  presetName: string;
  presetPrompt: string;
  skillId?: string;
  skillName: string;
  styleProfileId: string;
  styleProfileSource: 'builtin' | 'skill' | '';
  prompt: string;
  aspectRatio: string;
  quality: string;
  requestedSize: string;
  referenceCount: number;
  parentGenerationId?: string;
  isFavorited: boolean;
  status: AIImageGenerationStatus;
  stage: AIImageGenerationStage;
  resultUrl: string;
  resultWidth: number;
  resultHeight: number;
  resultSize: number;
  canvasSnapshotUrl: string;
  canvasSnapshotWidth: number;
  canvasSnapshotHeight: number;
  resourceId?: string;
  errorCode: string;
  errorMessage: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAIImageGenerationInput {
  modelId: string;
  recipeId: string;
  styleProfileId?: string;
  brief: string;
  aspectRatio: string;
  quality: string;
  references: string[];
  referenceGenerationId?: string;
}

export type AIImageConversationMessageRole = 'user' | 'assistant';
export type AIImageResourceVisibility = 'private' | 'public';

export interface AIImageConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIImageConversationMessage {
  id: string;
  userId: string;
  conversationId: string;
  role: AIImageConversationMessageRole;
  content: string;
  generationId?: string;
  createdAt: string;
}

export interface AIImageConversationPayload {
  conversation: AIImageConversation | null;
  messages: AIImageConversationMessage[];
}

export interface AIImageConversationCreatedPayload {
  conversation: AIImageConversation;
  messages: AIImageConversationMessage[];
}

export const listAIImageCreationOptions = () =>
  request.get<unknown, AIImageCreationOptions>('/ai/image-options');

export const generateAIImageRecipeSamples = (recipeId: string, excludedPrompts: string[]) =>
  request.post<unknown, { list: string[]; model: string }>(
    `/ai/image-recipes/${recipeId}/sample-prompts`,
    { excludedPrompts },
  );

export const listAIImageGenerations = (limit = 24) =>
  request.get<unknown, { list: AIImageGeneration[] }>('/ai/image-generations', {
    params: { limit },
  });

export const createAIImageGeneration = (data: CreateAIImageGenerationInput) =>
  request.post<unknown, { generation: AIImageGeneration }>('/ai/image-generations', data, {
    timeout: 30000,
  });

export const getAIImageGeneration = (generationId: string) =>
  request.get<unknown, { generation: AIImageGeneration }>(`/ai/image-generations/${generationId}`);

export const getAIImageGenerationImageData = (generationId: string) =>
  request.get<unknown, { imageBase64: string }>(`/ai/image-generations/${generationId}/image-data`);

export const pauseAIImageGeneration = (generationId: string) =>
  request.post<unknown, { generation: AIImageGeneration }>(
    `/ai/image-generations/${generationId}/pause`,
  );

export const deleteAIImageGeneration = (generationId: string) =>
  request.delete<unknown, { deleted: boolean }>(`/ai/image-generations/${generationId}`);

export const updateAIImageGenerationFavorite = (generationId: string, favorited: boolean) =>
  request.patch<unknown, { generation: AIImageGeneration }>(
    `/ai/image-generations/${generationId}/favorite`,
    { favorited },
  );

export const saveAIImageGenerationResource = (
  generationId: string,
  data: { visibility?: AIImageResourceVisibility },
) =>
  request.post<unknown, { resource: { id: string }; metadataModel?: string }>(
    `/ai/image-generations/${generationId}/resource`,
    data,
  );

export const getCurrentAIImageConversation = () =>
  request.get<unknown, AIImageConversationPayload>('/ai/image-conversations/current');

export const listAIImageConversations = () =>
  request.get<unknown, { list: AIImageConversation[] }>('/ai/image-conversations');

export const getAIImageConversation = (conversationId: string) =>
  request.get<unknown, AIImageConversationPayload>(`/ai/image-conversations/${conversationId}`);

export const clearCurrentAIImageConversation = () =>
  request.delete<unknown, AIImageConversationPayload>('/ai/image-conversations/current');

export const clearAIImageConversation = (conversationId: string) =>
  request.delete<unknown, AIImageConversationPayload>(
    `/ai/image-conversations/${conversationId}/messages`,
  );

export const createAIImageConversation = (data: { title?: string } = {}) =>
  request.post<unknown, AIImageConversationCreatedPayload>('/ai/image-conversations', data);

export const addAIImageConversationMessage = (
  conversationId: string,
  data: {
    role: AIImageConversationMessageRole;
    content: string;
    generationId?: string;
  },
) =>
  request.post<unknown, { conversation: AIImageConversation; message: AIImageConversationMessage }>(
    `/ai/image-conversations/${conversationId}/messages`,
    data,
  );
