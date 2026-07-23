import request from '@/utils/request';

export type AIImageGenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type AIImageGenerationStage = 'preparing' | 'generating' | 'storing' | 'completed';

export interface AIImagePreset {
  id: string;
  name: string;
  description: string;
  requiresReference: boolean;
  recommendedAspect: string;
}

export interface AIImagePresetCatalog {
  presets: AIImagePreset[];
  aspectRatios: string[];
  qualities: string[];
}

export interface AIImageGeneration {
  id: string;
  modelCatalogId: string;
  provider: string;
  model: string;
  presetId: string;
  prompt: string;
  aspectRatio: string;
  quality: string;
  requestedSize: string;
  referenceCount: number;
  status: AIImageGenerationStatus;
  stage: AIImageGenerationStage;
  resultUrl: string;
  resultWidth: number;
  resultHeight: number;
  resultSize: number;
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
  presetId: string;
  prompt: string;
  aspectRatio: string;
  quality: string;
  references: string[];
}

export const listAIImagePresets = () =>
  request.get<unknown, AIImagePresetCatalog>('/ai/image-presets');

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

export const saveAIImageGenerationResource = (
  generationId: string,
  data: { type: 'wallpaper' | 'avatar'; title?: string },
) =>
  request.post<unknown, { resource: { id: string } }>(
    `/ai/image-generations/${generationId}/resource`,
    data,
  );
