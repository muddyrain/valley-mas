import { apiRequest } from '@/api/request';
import type { PhotoItemAnalysisHistoryItem } from '@/lib/photoItemAnalysis';

export function listPhotoItemAnalysisDrafts(token: string) {
  return apiRequest<{ list: PhotoItemAnalysisHistoryItem[] }>(
    '/life-trace/pantry/photo-drafts',
    token,
    {
      suppressErrorToast: true,
    },
  );
}

export function syncPhotoItemAnalysisDrafts(token: string, items: PhotoItemAnalysisHistoryItem[]) {
  return apiRequest<{ synced: number }>('/life-trace/pantry/photo-drafts/sync', token, {
    method: 'POST',
    body: JSON.stringify({ items }),
    suppressErrorToast: true,
  });
}

export function upsertPhotoItemAnalysisDraft(token: string, item: PhotoItemAnalysisHistoryItem) {
  return apiRequest<PhotoItemAnalysisHistoryItem>(
    `/life-trace/pantry/photo-drafts/${encodeURIComponent(item.id)}`,
    token,
    {
      method: 'PUT',
      body: JSON.stringify(item),
      suppressErrorToast: true,
    },
  );
}

export function deletePhotoItemAnalysisDraft(token: string, id: string) {
  return apiRequest<{ id: string }>(
    `/life-trace/pantry/photo-drafts/${encodeURIComponent(id)}`,
    token,
    {
      method: 'DELETE',
      suppressErrorToast: true,
    },
  );
}
