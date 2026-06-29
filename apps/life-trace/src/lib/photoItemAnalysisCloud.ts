import {
  deletePhotoItemAnalysisDraft,
  listPhotoItemAnalysisDrafts,
  syncPhotoItemAnalysisDrafts,
  upsertPhotoItemAnalysisDraft,
} from '@/api/photoItemDrafts';
import {
  markPhotoItemAnalysisQualityFeedback,
  markPhotoItemAnalysisSaved,
  type PhotoItemAnalysisHistoryItem,
  type PhotoItemAnalysisQualityRating,
  readPhotoItemAnalysisHistory,
  removePhotoItemAnalysisHistory,
  upsertPhotoItemAnalysisHistory,
  writePhotoItemAnalysisHistory,
} from '@/lib/photoItemAnalysis';

type OptionalAuthToken = string | null | undefined;

export async function loadPhotoItemAnalysisHistory(token?: OptionalAuthToken) {
  const localItems = readPhotoItemAnalysisHistory();
  if (!token) {
    return localItems;
  }

  try {
    if (localItems.length > 0) {
      await syncPhotoItemAnalysisDrafts(token, localItems);
    }
    const data = await listPhotoItemAnalysisDrafts(token);
    writePhotoItemAnalysisHistory(data.list);
    return readPhotoItemAnalysisHistory();
  } catch {
    return readPhotoItemAnalysisHistory();
  }
}

export async function persistPhotoItemAnalysisHistoryItem(
  token: OptionalAuthToken,
  item: PhotoItemAnalysisHistoryItem,
) {
  upsertPhotoItemAnalysisHistory(item);
  if (!token) {
    return readPhotoItemAnalysisHistory();
  }

  try {
    const saved = await upsertPhotoItemAnalysisDraft(token, item);
    upsertPhotoItemAnalysisHistory(saved);
  } catch {
    // Local history remains the offline fallback when cloud sync is unavailable.
  }
  return readPhotoItemAnalysisHistory();
}

export async function markPhotoItemAnalysisHistorySaved(
  token: OptionalAuthToken,
  id: string,
  savedItemId?: string,
) {
  markPhotoItemAnalysisSaved(id, savedItemId);
  const item = readPhotoItemAnalysisHistory().find((historyItem) => historyItem.id === id);
  if (token && item) {
    try {
      await upsertPhotoItemAnalysisDraft(token, item);
    } catch {
      // Keep the local saved marker and retry through the next cloud load/sync.
    }
  }
  return readPhotoItemAnalysisHistory();
}

export async function markPhotoItemAnalysisHistoryQualityFeedback(
  token: OptionalAuthToken,
  id: string,
  rating: PhotoItemAnalysisQualityRating,
) {
  markPhotoItemAnalysisQualityFeedback(id, rating);
  const item = readPhotoItemAnalysisHistory().find((historyItem) => historyItem.id === id);
  if (token && item) {
    try {
      await upsertPhotoItemAnalysisDraft(token, item);
    } catch {
      // Keep local feedback; the next cloud load syncs it.
    }
  }
  return readPhotoItemAnalysisHistory();
}

export async function removePhotoItemAnalysisHistoryItem(token: OptionalAuthToken, id: string) {
  removePhotoItemAnalysisHistory(id);
  if (token) {
    try {
      await deletePhotoItemAnalysisDraft(token, id);
    } catch {
      // The local remove is immediate; cloud failures are non-blocking for draft cleanup.
    }
  }
  return readPhotoItemAnalysisHistory();
}
