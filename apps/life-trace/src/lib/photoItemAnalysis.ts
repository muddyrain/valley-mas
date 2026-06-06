import type { PantryPhotoAnalysisResponse } from '@/api/pantry';
import { buildDefaultPantryReminder } from '@/lib/pantry';
import type {
  NewPantryItemInput,
  PantryCategory,
  PantryItem,
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

export type PhotoItemAnalysisQualityRating = 'accurate' | 'inaccurate';

export type PhotoItemAnalysisCoverMode = 'original' | 'crop';

export type PhotoItemAnalysisQualityFeedback = {
  rating: PhotoItemAnalysisQualityRating;
  createdAt: string;
};

export type PhotoItemAnalysisReviewIssueAction =
  | 'open-sheet'
  | 'clear-expiry'
  | 'mark-brand-unknown'
  | 'mark-spec-unknown'
  | 'none';

export type PhotoItemAnalysisReviewIssue = {
  id: string;
  label: string;
  description: string;
  action: PhotoItemAnalysisReviewIssueAction;
  actionLabel?: string;
};

export type PhotoItemAnalysisSmartSuggestion = {
  id: string;
  label: string;
  description: string;
  actionLabel: string;
  source: 'history' | 'preference';
  patch: Partial<Pick<PhotoItemDraftForm, 'householdId' | 'location' | 'unit' | 'reminderEnabled'>>;
};

export type PhotoItemAnalysisDuplicateCandidate = {
  item: PantryItem;
  reason: string;
};

export type PhotoItemCropPreviewLayoutInput = {
  containerWidth: number;
  containerHeight: number;
  naturalWidth: number;
  naturalHeight: number;
  cropBox?: PantryPhotoAnalysisResponse['cropBox'];
};

export type PhotoItemCropPreviewLayout = {
  width: number;
  height: number;
  left: number;
  top: number;
};

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
  coverMode?: PhotoItemAnalysisCoverMode;
  qualityFeedback?: PhotoItemAnalysisQualityFeedback;
};

type BuildPhotoItemPantryInputOptions = {
  form: PhotoItemDraftForm;
  pantryPreferences: PantryPreferences;
  uploadedImageUrl: string;
  thumbnailUrl?: string;
};

type BuildPhotoItemAnalysisSmartSuggestionsOptions = {
  analysis: PantryPhotoAnalysisResponse;
  form: PhotoItemDraftForm;
  pantryItems: PantryItem[];
  pantryPreferences: PantryPreferences;
  preferredHouseholdId?: string;
  preferredHouseholdName?: string;
};

type FindPhotoItemAnalysisDuplicateCandidatesOptions = {
  analysis: PantryPhotoAnalysisResponse;
  form: PhotoItemDraftForm;
  pantryItems: PantryItem[];
};

type BuildPhotoItemMergedPantryInputOptions = {
  existingItem: PantryItem;
  form: PhotoItemDraftForm;
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
    coverMode: candidate.coverMode === 'crop' ? 'crop' : 'original',
    qualityFeedback:
      candidate.qualityFeedback?.rating === 'accurate' ||
      candidate.qualityFeedback?.rating === 'inaccurate'
        ? {
            rating: candidate.qualityFeedback.rating,
            createdAt:
              typeof candidate.qualityFeedback.createdAt === 'string'
                ? candidate.qualityFeedback.createdAt
                : candidate.createdAt,
          }
        : undefined,
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
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .filter(
        (item, index, history) =>
          history.findIndex((candidate) => candidate.id === item.id) === index,
      )
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
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const deduped = normalized
    .filter(
      (item, index, history) =>
        history.findIndex((candidate) => candidate.id === item.id) === index,
    )
    .slice(0, MAX_PHOTO_ITEM_ANALYSIS_HISTORY);

  storage.setItem(PHOTO_ITEM_ANALYSIS_HISTORY_KEY, JSON.stringify(deduped));
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

export function getPhotoItemAnalysisDraftById(
  id: string,
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  return (
    readPhotoItemAnalysisHistory(storage).find(
      (item) => item.id === id && item.status === 'draft',
    ) ?? null
  );
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

export function markPhotoItemAnalysisQualityFeedback(
  id: string,
  rating: PhotoItemAnalysisQualityRating,
  storage: HistoryStorage | null = getPhotoItemAnalysisStorage(),
) {
  const now = new Date().toISOString();
  const current = readPhotoItemAnalysisHistory(storage);
  writePhotoItemAnalysisHistory(
    current.map((item) =>
      item.id === id
        ? {
            ...item,
            qualityFeedback: {
              rating,
              createdAt: now,
            },
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

function includesAnyKeyword(values: string[], keywords: string[]) {
  return values.some((value) => keywords.some((keyword) => value.includes(keyword)));
}

function normalizeSuggestionText(value: string) {
  return value.trim().toLowerCase();
}

function isUsablePantryHistoryItem(item: PantryItem) {
  return item.status !== 'discarded' && item.status !== 'used-up';
}

function isRelatedPantryHistoryItem(analysis: PantryPhotoAnalysisResponse, item: PantryItem) {
  const itemName = normalizeSuggestionText(item.name);
  const analysisName = normalizeSuggestionText(analysis.name);
  const brand = normalizeSuggestionText(analysis.brand ?? '');
  const spec = normalizeSuggestionText(analysis.spec ?? '');

  if (item.category === analysis.category) {
    return true;
  }
  if (analysisName && (itemName.includes(analysisName) || analysisName.includes(itemName))) {
    return true;
  }
  if (brand && itemName.includes(brand)) {
    return true;
  }
  if (spec && itemName.includes(spec)) {
    return true;
  }
  return false;
}

function getTopFrequencyValue<T extends string>(values: T[]) {
  const countByValue = values.reduce<Map<T, number>>((result, value) => {
    result.set(value, (result.get(value) ?? 0) + 1);
    return result;
  }, new Map<T, number>());

  return [...countByValue.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
}

function parseDraftQuantity(value: string) {
  return Number.parseInt(value, 10) || 1;
}

function clampRatio(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

export function normalizePhotoItemCropBox(
  cropBox: PantryPhotoAnalysisResponse['cropBox'] | undefined,
) {
  if (!cropBox) {
    return null;
  }

  const x = clampRatio(cropBox.x);
  const y = clampRatio(cropBox.y);
  const width = Math.min(1 - x, Math.max(0, cropBox.width));
  const height = Math.min(1 - y, Math.max(0, cropBox.height));
  if (width < 0.12 || height < 0.12) {
    return null;
  }
  return { x, y, width, height };
}

export function isMeaningfulPhotoItemCropBox(
  cropBox: PantryPhotoAnalysisResponse['cropBox'] | undefined,
) {
  const normalized = normalizePhotoItemCropBox(cropBox);
  if (!normalized) {
    return false;
  }
  const area = normalized.width * normalized.height;
  const isGenericFallback =
    Math.abs(normalized.x - 0.1) < 0.035 &&
    Math.abs(normalized.y - 0.1) < 0.035 &&
    Math.abs(normalized.width - 0.8) < 0.05 &&
    Math.abs(normalized.height - 0.8) < 0.05;

  return (
    !isGenericFallback && area <= 0.58 && normalized.width <= 0.86 && normalized.height <= 0.86
  );
}

export function buildPhotoItemCropBoxStyle(
  cropBox: PantryPhotoAnalysisResponse['cropBox'] | undefined,
) {
  const normalized = normalizePhotoItemCropBox(cropBox);
  if (!normalized) {
    return null;
  }
  return {
    left: `${normalized.x * 100}%`,
    top: `${normalized.y * 100}%`,
    width: `${normalized.width * 100}%`,
    height: `${normalized.height * 100}%`,
  };
}

export function calculatePhotoItemCropPreviewLayout({
  containerWidth,
  containerHeight,
  naturalWidth,
  naturalHeight,
  cropBox,
}: PhotoItemCropPreviewLayoutInput): PhotoItemCropPreviewLayout | null {
  const normalized = normalizePhotoItemCropBox(cropBox);
  if (!normalized || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  const cropX = normalized.x * naturalWidth;
  const cropY = normalized.y * naturalHeight;
  const cropWidth = normalized.width * naturalWidth;
  const cropHeight = normalized.height * naturalHeight;
  const scale = Math.max(containerWidth / cropWidth, containerHeight / cropHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  return {
    width: Math.round(width),
    height: Math.round(height),
    left: Math.round((containerWidth - cropWidth * scale) / 2 - cropX * scale),
    top: Math.round((containerHeight - cropHeight * scale) / 2 - cropY * scale),
  };
}

function normalizeDuplicateText(value: string) {
  return normalizeSuggestionText(value).replace(/\s+/g, '');
}

function appendMergeNote(existingNote: string, newNote: string) {
  const current = existingNote.trim();
  const incoming = newNote.trim();
  if (!incoming || current.includes(incoming)) {
    return current;
  }
  return [current, `拍照追加：${incoming}`].filter(Boolean).join('\n');
}

export function findPhotoItemAnalysisDuplicateCandidates({
  analysis,
  form,
  pantryItems,
}: FindPhotoItemAnalysisDuplicateCandidatesOptions): PhotoItemAnalysisDuplicateCandidate[] {
  const targetHouseholdId = form.householdId.trim();
  const formName = normalizeDuplicateText(form.name || analysis.name);
  const analysisName = normalizeDuplicateText(analysis.name);
  const brand = normalizeDuplicateText(analysis.brand ?? '');
  const spec = normalizeDuplicateText(analysis.spec ?? '');

  return pantryItems
    .filter(isUsablePantryHistoryItem)
    .filter((item) => (item.householdId ?? '') === targetHouseholdId)
    .filter((item) => item.category === form.category)
    .filter((item) => item.location === form.location)
    .filter((item) => item.unit.trim() === form.unit.trim())
    .map((item): PhotoItemAnalysisDuplicateCandidate | null => {
      const itemName = normalizeDuplicateText(item.name);
      const itemNote = normalizeDuplicateText(item.note);
      const sameName = Boolean(
        formName &&
          (itemName === formName || itemName.includes(formName) || formName.includes(itemName)),
      );
      const sameAnalysisName = Boolean(
        analysisName &&
          (itemName === analysisName ||
            itemName.includes(analysisName) ||
            analysisName.includes(itemName)),
      );
      const sameBrandOrSpec = Boolean(
        (brand && (itemName.includes(brand) || itemNote.includes(brand))) ||
          (spec && (itemName.includes(spec) || itemNote.includes(spec))),
      );

      if (!sameName && !sameAnalysisName && !sameBrandOrSpec) {
        return null;
      }

      const reason = sameName || sameAnalysisName ? '名称、单位和位置相同' : '品牌或规格线索相似';
      return { item, reason };
    })
    .filter((candidate): candidate is PhotoItemAnalysisDuplicateCandidate => Boolean(candidate))
    .sort((left, right) => {
      const leftUpdatedAt = Date.parse(left.item.updatedAt ?? left.item.createdAt ?? '');
      const rightUpdatedAt = Date.parse(right.item.updatedAt ?? right.item.createdAt ?? '');
      return (
        (Number.isNaN(rightUpdatedAt) ? 0 : rightUpdatedAt) -
        (Number.isNaN(leftUpdatedAt) ? 0 : leftUpdatedAt)
      );
    })
    .slice(0, 3);
}

export function buildPhotoItemMergedPantryInput({
  existingItem,
  form,
}: BuildPhotoItemMergedPantryInputOptions): NewPantryItemInput {
  return {
    householdId: existingItem.householdId,
    name: existingItem.name,
    category: existingItem.category,
    quantity: existingItem.quantity + parseDraftQuantity(form.quantity),
    unit: existingItem.unit,
    location: existingItem.location,
    expiresAt: existingItem.expiresAt,
    openedAt: existingItem.openedAt,
    note: appendMergeNote(existingItem.note, form.note),
    imageUrl: existingItem.imageUrl,
    thumbnailUrl: existingItem.thumbnailUrl,
    status: existingItem.status,
    reminder: existingItem.reminder,
  };
}

export function buildPhotoItemAnalysisSmartSuggestions({
  analysis,
  form,
  pantryItems,
  pantryPreferences,
  preferredHouseholdId = '',
  preferredHouseholdName = '',
}: BuildPhotoItemAnalysisSmartSuggestionsOptions): PhotoItemAnalysisSmartSuggestion[] {
  const suggestions: PhotoItemAnalysisSmartSuggestion[] = [];
  const normalizedPreferredHouseholdId = preferredHouseholdId.trim();
  const targetHouseholdId = form.householdId.trim() || normalizedPreferredHouseholdId;
  const relatedHistory = pantryItems
    .filter(isUsablePantryHistoryItem)
    .filter((item) => !targetHouseholdId || (item.householdId ?? '') === targetHouseholdId)
    .filter((item) => isRelatedPantryHistoryItem(analysis, item));

  if (normalizedPreferredHouseholdId && form.householdId !== normalizedPreferredHouseholdId) {
    suggestions.push({
      id: 'household',
      label: '家庭空间建议',
      description: `当前常用库存空间是「${preferredHouseholdName || '共享空间'}」，可以直接保存到这个空间。`,
      actionLabel: `使用「${preferredHouseholdName || '共享空间'}」`,
      source: 'preference',
      patch: { householdId: normalizedPreferredHouseholdId },
    });
  }

  const topLocation = getTopFrequencyValue(relatedHistory.map((item) => item.location));
  if (
    topLocation &&
    topLocation[0] !== form.location &&
    (topLocation[1] >= 2 || relatedHistory.length === 1)
  ) {
    suggestions.push({
      id: 'location',
      label: '存放位置建议',
      description:
        topLocation[1] > 1
          ? `相似库存里有 ${topLocation[1]} 件常放在「${topLocation[0]}」。`
          : `相似库存常放在「${topLocation[0]}」。`,
      actionLabel: `使用「${topLocation[0]}」`,
      source: 'history',
      patch: { location: topLocation[0] },
    });
  }

  const topUnit = getTopFrequencyValue(relatedHistory.map((item) => item.unit).filter(Boolean));
  if (topUnit && topUnit[0] !== form.unit && (topUnit[1] >= 2 || relatedHistory.length === 1)) {
    suggestions.push({
      id: 'unit',
      label: '单位建议',
      description:
        topUnit[1] > 1
          ? `相似库存里有 ${topUnit[1]} 件使用「${topUnit[0]}」作为单位。`
          : `相似库存使用「${topUnit[0]}」作为单位。`,
      actionLabel: `使用「${topUnit[0]}」`,
      source: 'history',
      patch: { unit: topUnit[0] },
    });
  }

  const topReminder = getTopFrequencyValue(
    relatedHistory
      .filter((item) => item.expiresAt)
      .map((item) => (item.reminder.enabled ? 'enabled' : 'disabled')),
  );
  if (
    form.expiresAt.trim() &&
    !form.reminderEnabled &&
    (pantryPreferences.defaultReminderEnabled || topReminder?.[0] === 'enabled')
  ) {
    suggestions.push({
      id: 'reminder',
      label: '提醒建议',
      description:
        topReminder?.[0] === 'enabled'
          ? '相似库存通常会开启到期提醒，可以按 Pantry 默认规则提醒。'
          : '已识别到保质期，可以按 Pantry 默认规则开启到期提醒。',
      actionLabel: '开启提醒',
      source: topReminder?.[0] === 'enabled' ? 'history' : 'preference',
      patch: { reminderEnabled: true },
    });
  }

  return suggestions.slice(0, 3);
}

export function getPhotoItemAnalysisReviewIssues(
  analysis: PantryPhotoAnalysisResponse,
  form: PhotoItemDraftForm,
): PhotoItemAnalysisReviewIssue[] {
  const warnings = analysis.warnings ?? [];
  const issues: PhotoItemAnalysisReviewIssue[] = [];
  const note = form.note.trim();
  const confidence = Number.isFinite(analysis.confidence) ? analysis.confidence : 0;
  const lowConfidence = confidence > 0 && confidence < 0.75;
  const veryLowConfidence = confidence > 0 && confidence < 0.55;

  if (lowConfidence) {
    issues.push({
      id: 'confidence',
      label: '整体置信度偏低',
      description: `AI 置信度约 ${Math.round(confidence * 100)}%，保存前建议逐项确认名称、分类、数量和位置。`,
      action: 'open-sheet',
      actionLabel: '去确认',
    });
  }

  if (
    veryLowConfidence ||
    !form.name.trim() ||
    form.name.includes('未知') ||
    includesAnyKeyword(warnings, ['名称', '商品', '不确定', '无法识别'])
  ) {
    issues.push({
      id: 'name',
      label: '商品名称需要确认',
      description: '名称会直接写入库存列表，建议打开确认表单核对后再入库。',
      action: 'open-sheet',
      actionLabel: '编辑名称',
    });
  }

  if (
    !analysis.brand?.trim() &&
    !note.includes('品牌未知') &&
    (lowConfidence || includesAnyKeyword(warnings, ['品牌']))
  ) {
    issues.push({
      id: 'brand',
      label: '品牌未识别',
      description: '如果品牌不重要，可以一键标记为未知，避免后续误以为 AI 已确认品牌。',
      action: 'mark-brand-unknown',
      actionLabel: '标记未知',
    });
  }

  if (
    !analysis.spec?.trim() &&
    !note.includes('规格不记录') &&
    (lowConfidence || includesAnyKeyword(warnings, ['规格', '容量']))
  ) {
    issues.push({
      id: 'spec',
      label: '规格未识别',
      description: '规格不确定时可以不记录；如果需要精确数量，可在单位或备注里手动补充。',
      action: 'mark-spec-unknown',
      actionLabel: '不记录规格',
    });
  }

  if (
    !form.expiresAt.trim() &&
    !note.includes('不记录保质期') &&
    (Boolean(analysis.shelfLifeDays) ||
      Boolean(analysis.productionDate) ||
      Boolean(analysis.purchaseDate) ||
      includesAnyKeyword(warnings, ['保质期', '生产日期', '到期', '过期']))
  ) {
    issues.push({
      id: 'expiry',
      label: '保质期需要确认',
      description: 'AI 没有得到完整到期日。可以手动补日期，也可以明确作为普通物品不记录保质期。',
      action: 'clear-expiry',
      actionLabel: '不记录保质期',
    });
  }

  if (includesAnyKeyword(warnings, ['多个商品', '多商品', '主体'])) {
    issues.push({
      id: 'multi-item',
      label: '画面可能包含多个商品',
      description: '当前只会入库一件商品。请确认正在保存的是画面主体商品。',
      action: 'open-sheet',
      actionLabel: '核对字段',
    });
  }

  return issues.filter(
    (issue, index, allIssues) => allIssues.findIndex((item) => item.id === issue.id) === index,
  );
}

export function buildPhotoItemPantryInput({
  form,
  pantryPreferences,
  uploadedImageUrl,
  thumbnailUrl = '',
}: BuildPhotoItemPantryInputOptions): NewPantryItemInput {
  const expiresAt = form.expiresAt.trim();
  const openedAt = form.openedAt.trim();

  return {
    householdId: form.householdId || undefined,
    name: form.name.trim(),
    category: form.category,
    quantity: parseDraftQuantity(form.quantity),
    unit: form.unit.trim() || '件',
    location: form.location,
    expiresAt: expiresAt || undefined,
    openedAt: openedAt || undefined,
    note: form.note.trim(),
    imageUrl: uploadedImageUrl || undefined,
    thumbnailUrl: thumbnailUrl || undefined,
    status: 'normal',
    reminder: buildDefaultPantryReminder(
      pantryPreferences,
      Boolean(expiresAt) && form.reminderEnabled,
    ),
  };
}
