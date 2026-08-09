import { useAuthStore } from '@/stores/useAuthStore';
import request from '@/utils/request';

export type AIMotionStickerStatus = 'queued' | 'running' | 'succeeded' | 'failed';
export type AIMotionStickerMode = 'image' | 'video';

export interface AIMotionStickerModel {
  id: string;
  name: string;
  provider: string;
  model: string;
  imageProtocol?: string;
  videoProtocol?: string;
}

export interface AIMotionStickerOptions {
  defaultMode: AIMotionStickerMode;
  imageModels: AIMotionStickerModel[];
  videoModels: AIMotionStickerModel[];
  defaults: {
    durationSeconds: number;
    resolution: string;
    aspectRatio: string;
    gifSize: number;
    frameCount: number;
  };
}

interface AIMotionStickerOptionsResponse {
  defaultMode?: AIMotionStickerMode;
  imageModels?: AIMotionStickerModel[];
  videoModels?: AIMotionStickerModel[];
  models?: AIMotionStickerModel[];
  defaults?: Partial<AIMotionStickerOptions['defaults']>;
}

export interface AIMotionSticker {
  id: string;
  modelCatalogId: string;
  provider: string;
  model: string;
  generationMode?: AIMotionStickerMode;
  frameCount?: number;
  action: string;
  aspectRatio: string;
  durationSeconds: number;
  resolution: string;
  status: AIMotionStickerStatus;
  stage: string;
  referencePreviewUrl: string;
  mp4Url?: string;
  gifUrl?: string;
  mp4Size?: number;
  gifSize?: number;
  gifWidth?: number;
  gifHeight?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface CreateAIMotionStickerInput {
  mode: AIMotionStickerMode;
  modelId: string;
  action: string;
  reference: File;
}

export const listAIMotionStickerOptions = async (): Promise<AIMotionStickerOptions> => {
  const response = await request.get<unknown, AIMotionStickerOptionsResponse>(
    '/ai/motion-sticker-options',
  );
  const imageModels = response.imageModels || [];
  const videoModels = response.videoModels || response.models || [];
  return {
    defaultMode: response.defaultMode || (imageModels.length > 0 ? 'image' : 'video'),
    imageModels,
    videoModels,
    defaults: {
      durationSeconds: response.defaults?.durationSeconds ?? 5,
      resolution: response.defaults?.resolution || '720p',
      aspectRatio: response.defaults?.aspectRatio || '1:1',
      gifSize: response.defaults?.gifSize ?? 320,
      frameCount: response.defaults?.frameCount ?? 6,
    },
  };
};

export const listAIMotionStickers = () =>
  request.get<unknown, { items: AIMotionSticker[] }>('/ai/motion-stickers');

export const getAIMotionSticker = (id: string) =>
  request.get<unknown, AIMotionSticker>(`/ai/motion-stickers/${id}`);

export const createAIMotionSticker = (input: CreateAIMotionStickerInput) => {
  const formData = new FormData();
  formData.append('mode', input.mode);
  formData.append('modelId', input.modelId);
  formData.append('action', input.action);
  formData.append('reference', input.reference);
  return request.post<unknown, AIMotionSticker>('/ai/motion-stickers', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 90000,
  });
};

export const deleteAIMotionSticker = (id: string) =>
  request.delete<unknown, { deleted: boolean }>(`/ai/motion-stickers/${id}`);

export async function fetchAIMotionStickerContent(
  id: string,
  format: 'reference' | 'mp4' | 'gif',
): Promise<Blob> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
  const token = useAuthStore.getState().token;
  const response = await fetch(
    `${baseURL}/ai/motion-stickers/${encodeURIComponent(id)}/content?format=${format}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : undefined, credentials: 'include' },
  );
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message || '读取动态表情文件失败');
  }
  return response.blob();
}
