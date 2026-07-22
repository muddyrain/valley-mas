import { apiRequest } from '@/api/request';

export type AvailableAIModel = {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  capabilities: string[];
};

export function listAvailableAIModels(token: string, capability: string) {
  return apiRequest<{ list: AvailableAIModel[] }>(
    `/ai/models?capability=${encodeURIComponent(capability)}`,
    token,
    { method: 'GET' },
  );
}
