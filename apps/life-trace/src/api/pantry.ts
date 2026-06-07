import { apiRequest } from '@/api/request';
import type {
  ListPagination,
  NewPantryItemInput,
  PantryItem,
  PantryItemStatus,
  PantryOverview,
} from '@/types';

export type ListPantryOptions = {
  page?: number;
  pageSize?: number;
  householdId?: string;
  status?: PantryItemStatus | 'all';
  category?: PantryItem['category'] | 'all';
  q?: string;
};

type PantryItemResponse = Omit<PantryItem, 'reminder'> & {
  reminderEnabled: boolean;
  reminderUseDefault: boolean;
  reminderRules: PantryItem['reminder']['rules'];
  reminderTime: string;
};

export type PantryThumbnailRequest = {
  name?: string;
  category: PantryItem['category'];
  location: PantryItem['location'];
  note?: string;
};

export type PantryThumbnailResponse = {
  thumbnailUrl: string;
  source: 'ark';
  model?: string;
};

export type PantryPhotoCropBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PantryPhotoOCRHint = {
  kind: 'production_date' | 'expiry_date' | 'shelf_life_days' | 'shelf_life_text';
  text: string;
  normalizedValue?: string;
  confidence?: number;
  sourceRegion?: PantryPhotoCropBox;
};

export type PantryPhotoDetectedItem = {
  id: string;
  name: string;
  category: PantryItem['category'];
  brand?: string;
  spec?: string;
  quantity: number;
  unit: string;
  storageLocation: PantryItem['location'];
  expiresAt?: string;
  productionDate?: string;
  purchaseDate?: string;
  shelfLifeDays?: number;
  barcodeValue?: string;
  barcodeFormat?: string;
  confidence: number;
  warnings: string[];
  cropBox?: PantryPhotoCropBox;
};

export type PantryPhotoAnalysisRequest = {
  imageUrl: string;
  householdId?: string;
  hint?: string;
  barcodeValue?: string;
  barcodeFormat?: string;
  barcodeSource?: string;
};

export type PantryPhotoAnalysisResponse = {
  name: string;
  category: PantryItem['category'];
  brand?: string;
  spec?: string;
  quantity: number;
  unit: string;
  storageLocation: PantryItem['location'];
  expiresAt?: string;
  productionDate?: string;
  purchaseDate?: string;
  shelfLifeDays?: number;
  barcodeValue?: string;
  barcodeFormat?: string;
  tags: string[];
  confidence: number;
  warnings: string[];
  cropBox: PantryPhotoCropBox;
  summary: string;
  multiItemDetected?: boolean;
  detectedItems: PantryPhotoDetectedItem[];
  ocrHints: PantryPhotoOCRHint[];
  householdId?: string;
  householdName?: string;
  source: 'ark';
  model?: string;
};

export type PantryBarcodeMatchRequest = {
  barcodeValue?: string;
  barcodeFormat?: string;
  householdId?: string;
};

export type PantryBarcodeMatchResponse = {
  matched: boolean;
  source?: 'pantry-history';
  matchedItemId?: string;
  householdId?: string;
  name?: string;
  category?: PantryItem['category'];
  unit?: string;
  location?: PantryItem['location'];
  barcodeValue?: string;
  barcodeFormat?: string;
  updatedAt?: string;
};

export type PantryConsumeAction = 'used' | 'discarded';

export type PantryConsumeRequest = {
  action: PantryConsumeAction;
  quantity: number;
};

export type PantryTransferMode = 'copy' | 'move';

export type PantryTransferConflictPolicy = 'merge' | 'keep-both';

export type PantryTransferItemSummary = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  location: PantryItem['location'];
  expiresAt?: string;
  openedAt?: string;
};

export type PantryTransferConflict = {
  sourceItem: PantryTransferItemSummary;
  targetItem: PantryTransferItemSummary;
  reason: string;
};

export type PantryTransferPreviewRequest = {
  sourceHouseholdId?: string;
  targetHouseholdId: string;
  itemIds: string[];
  mode: PantryTransferMode;
};

export type PantryTransferPreviewResponse = {
  sourceHouseholdId: string;
  sourceHouseholdName: string;
  targetHouseholdId: string;
  targetHouseholdName: string;
  mode: PantryTransferMode;
  itemCount: number;
  conflictCount: number;
  items: PantryTransferItemSummary[];
  conflicts: PantryTransferConflict[];
};

export type PantryTransferRequest = PantryTransferPreviewRequest & {
  conflictPolicy?: PantryTransferConflictPolicy;
};

export type PantryTransferResultItem = {
  sourceItemId: string;
  targetItemId: string;
  name: string;
  action: 'created' | 'merged';
};

export type PantryTransferResponse = {
  sourceHouseholdId: string;
  sourceHouseholdName: string;
  targetHouseholdId: string;
  targetHouseholdName: string;
  mode: PantryTransferMode;
  conflictPolicy?: PantryTransferConflictPolicy;
  processedCount: number;
  createdCount: number;
  mergedCount: number;
  deletedSourceCount: number;
  items: PantryTransferResultItem[];
};

function buildListQuery(options: ListPantryOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  if (options.householdId) {
    params.set('householdId', options.householdId);
  }
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  if (options.category && options.category !== 'all') {
    params.set('category', options.category);
  }
  if (options.q?.trim()) {
    params.set('q', options.q.trim());
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function serializePantryItemInput(input: NewPantryItemInput) {
  return {
    name: input.name,
    category: input.category,
    quantity: input.quantity,
    unit: input.unit,
    location: input.location,
    expiresAt: input.expiresAt,
    openedAt: input.openedAt,
    note: input.note,
    imageUrl: input.imageUrl,
    thumbnailUrl: input.thumbnailUrl,
    barcodeValue: input.barcodeValue,
    barcodeFormat: input.barcodeFormat,
    status: input.status,
    reminder: {
      enabled: input.reminder.enabled,
      useDefault: input.reminder.useDefault,
      rules: input.reminder.rules,
      reminderTime: input.reminder.reminderTime,
    },
  };
}

function deserializePantryItem(item: PantryItemResponse): PantryItem {
  return {
    ...item,
    imageUrl: item.imageUrl || undefined,
    thumbnailUrl: item.thumbnailUrl || undefined,
    barcodeValue: item.barcodeValue || undefined,
    barcodeFormat: item.barcodeFormat || undefined,
    reminder: {
      enabled: item.reminderEnabled,
      useDefault: item.reminderUseDefault,
      rules: item.reminderRules,
      reminderTime: item.reminderTime,
    },
  };
}

export function listPantry(token: string, options: ListPantryOptions = {}) {
  return apiRequest<{
    householdId?: string;
    householdName?: string;
    list: PantryItemResponse[];
    pagination?: ListPagination;
    summary?: PantryOverview;
  }>(`/life-trace/pantry${buildListQuery(options)}`, token).then((data) => ({
    ...data,
    list: data.list.map(deserializePantryItem),
  }));
}

function buildHouseholdPath(path: string, householdId?: string) {
  if (!householdId) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}householdId=${encodeURIComponent(householdId)}`;
}

export function createPantryItem(token: string, input: NewPantryItemInput, householdId?: string) {
  return apiRequest<PantryItemResponse>(
    buildHouseholdPath('/life-trace/pantry', householdId),
    token,
    {
      method: 'POST',
      body: JSON.stringify(serializePantryItemInput(input)),
    },
  ).then(deserializePantryItem);
}

export function updatePantryItem(
  token: string,
  id: string,
  input: NewPantryItemInput,
  householdId?: string,
) {
  return apiRequest<PantryItemResponse>(
    buildHouseholdPath(`/life-trace/pantry/${id}`, householdId),
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(serializePantryItemInput(input)),
    },
  ).then(deserializePantryItem);
}

export function updatePantryItemStatus(
  token: string,
  id: string,
  status: PantryItemStatus,
  householdId?: string,
) {
  return apiRequest<PantryItemResponse>(
    buildHouseholdPath(`/life-trace/pantry/${id}/status`, householdId),
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  ).then(deserializePantryItem);
}

export function consumePantryItem(
  token: string,
  id: string,
  input: PantryConsumeRequest,
  householdId?: string,
) {
  return apiRequest<PantryItemResponse>(
    buildHouseholdPath(`/life-trace/pantry/${id}/consume`, householdId),
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  ).then(deserializePantryItem);
}

export function deletePantryItem(token: string, id: string, householdId?: string) {
  return apiRequest<{ id: string }>(
    buildHouseholdPath(`/life-trace/pantry/${id}`, householdId),
    token,
    {
      method: 'DELETE',
    },
  );
}

export function lookupPantryBarcodeMatch(token: string, input: PantryBarcodeMatchRequest) {
  const params = new URLSearchParams();
  if (input.barcodeValue?.trim()) {
    params.set('barcodeValue', input.barcodeValue.trim());
  }
  if (input.barcodeFormat?.trim()) {
    params.set('barcodeFormat', input.barcodeFormat.trim());
  }
  if (input.householdId?.trim()) {
    params.set('householdId', input.householdId.trim());
  }
  const query = params.toString();
  return apiRequest<PantryBarcodeMatchResponse>(
    `/life-trace/pantry/barcode-match${query ? `?${query}` : ''}`,
    token,
  );
}

export function generatePantryThumbnail(
  token: string,
  input: PantryThumbnailRequest,
  options: { signal?: AbortSignal } = {},
) {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 45000);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });

  return apiRequest<PantryThumbnailResponse>('/life-trace/ai/pantry-thumbnail', token, {
    method: 'POST',
    body: JSON.stringify(input),
    signal: controller.signal,
  }).finally(() => globalThis.clearTimeout(timeout));
}

export function analyzePantryPhoto(token: string, input: PantryPhotoAnalysisRequest) {
  return apiRequest<PantryPhotoAnalysisResponse>('/life-trace/ai/pantry-photo-analysis', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function previewPantryTransfer(token: string, input: PantryTransferPreviewRequest) {
  return apiRequest<PantryTransferPreviewResponse>('/life-trace/pantry/transfer/preview', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function transferPantryItems(token: string, input: PantryTransferRequest) {
  return apiRequest<PantryTransferResponse>('/life-trace/pantry/transfer', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
