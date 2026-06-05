import type { PantryPhotoAnalysisResponse } from '@/api/pantry';
import { buildDefaultPantryReminder } from '@/lib/pantry';
import type {
  NewPantryItemInput,
  PantryCategory,
  PantryLocation,
  PantryPreferences,
} from '@/types';

export type PhotoItemDraftForm = {
  name: string;
  category: PantryCategory;
  quantity: string;
  unit: string;
  location: PantryLocation;
  expiresAt: string;
  openedAt: string;
  note: string;
  householdId: string;
  reminderEnabled: boolean;
};

export type PhotoItemAnalysisHistoryStatus = 'draft' | 'saved';

export type PhotoItemAnalysisHistoryItem = {
  id: string;
  imageUrl: string;
  imageName?: string;
  analysis: PantryPhotoAnalysisResponse;
  form: PhotoItemDraftForm;
  expiryBaseDate?: string;
  householdName?: string;
  status: PhotoItemAnalysisHistoryStatus;
  createdAt: string;
  updatedAt: string;
  savedAt?: string;
  savedItemId?: string;
};

type BuildPhotoItemPantryInputOptions = {
  form: PhotoItemDraftForm;
  pantryPreferences: PantryPreferences;
  uploadedImageUrl: string;
};

const PHOTO_ITEM_ANALYSIS_HISTORY_KEY = 'life-trace-photo-item-analysis-history-v1';
const MAX_PHOTO_ITEM_ANALYSIS_HISTORY = 8;

type HistoryStorage = Pick<Storage, 'getItem' | 'setItem'>;

function getPhotoItemAnalysisStorage(): HistoryStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

function normalizeHistoryItem(item: unknown): PhotoItemAnalysisHistoryItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const candidate = item as Partial<PhotoItemAnalysisHistoryItem>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.imageUrl !== 'string' ||
    !candidate.analysis ||
    !candidate.form ||
    typeof candidate.createdAt !== 'string'
  ) {
    return null;
  }

  return {
    id: candidate.id,
    imageUrl: candidate.imageUrl,
    imageName: typeof candidate.imageName === 'string' ? candidate.imageName : undefined,
    analysis: candidate.analysis,
    form: candidate.form,
    expiryBaseDate:
      typeof candidate.expiryBaseDate === 'string' ? candidate.expiryBaseDate : undefined,
    householdName:
      typeof candidate.householdName === 'string' ? candidate.householdName : undefined,
    status: candidate.status === 'saved' ? 'saved' : 'draft',
    createdAt: candidate.createdAt,
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : candidate.createdAt,
    savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : undefined,
    savedItemId: typeof candidate.savedItemId === 'string' ? candidate.savedItemId : undefined,
  };
}

export function createPhotoItemAnalysisHistoryId(now = Date.now()) {
  return `photo-item-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readPhotoItemAnalysisHistory(
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
): PhotoItemAnalysisHistoryItem[] {
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(PHOTO_ITEM_ANALYSIS_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(normalizeHistoryItem)
      .filter((item): item is PhotoItemAnalysisHistoryItem => Boolean(item))
      .slice(0, MAX_PHOTO_ITEM_ANALYSIS_HISTORY);
  } catch {
    return [];
  }
}

export function writePhotoItemAnalysisHistory(
  items: PhotoItemAnalysisHistoryItem[],
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  if (!storage) {
    return;
  }

  const normalized = items
    .map(normalizeHistoryItem)
    .filter((item): item is PhotoItemAnalysisHistoryItem => Boolean(item))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, MAX_PHOTO_ITEM_ANALYSIS_HISTORY);

  storage.setItem(PHOTO_ITEM_ANALYSIS_HISTORY_KEY, JSON.stringify(normalized));
}

export function upsertPhotoItemAnalysisHistory(
  item: PhotoItemAnalysisHistoryItem,
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  const current = readPhotoItemAnalysisHistory(storage);
  writePhotoItemAnalysisHistory(
    [item, ...current.filter((historyItem) => historyItem.id !== item.id)],
    storage,
  );
}

export function getLatestPhotoItemAnalysisDraft(
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  return readPhotoItemAnalysisHistory(storage).find((item) => item.status === 'draft') ?? null;
}

export function markPhotoItemAnalysisSaved(
  id: string,
  savedItemId?: string,
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  const now = new Date().toISOString();
  const current = readPhotoItemAnalysisHistory(storage);
  writePhotoItemAnalysisHistory(
    current.map((item) =>
      item.id === id
        ? {
            ...item,
            status: 'saved',
            savedAt: now,
            savedItemId,
            updatedAt: now,
          }
        : item,
    ),
    storage,
  );
}

export function removePhotoItemAnalysisHistory(
  id: string,
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  writePhotoItemAnalysisHistory(
    readPhotoItemAnalysisHistory(storage).filter((item) => item.id !== id),
    storage,
  );
}

export function buildPhotoItemPantryInput({
  form,
  pantryPreferences,
  uploadedImageUrl,
}: BuildPhotoItemPantryInputOptions): NewPantryItemInput {
  const expiresAt = form.expiresAt.trim();
  const openedAt = form.openedAt.trim();

  return {
    householdId: form.householdId || undefined,
    name: form.name.trim(),
    category: form.category,
    quantity: Number.parseInt(form.quantity, 10) || 1,
    unit: form.unit.trim() || '件',
    location: form.location,
    expiresAt: expiresAt || undefined,
    openedAt: openedAt || undefined,
    note: form.note.trim(),
    imageUrl: uploadedImageUrl || undefined,
    thumbnailUrl: undefined,
    status: 'normal',
    reminder: buildDefaultPantryReminder(
      pantryPreferences,
      Boolean(expiresAt) && form.reminderEnabled,
    ),
  };
}
