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

export type PantryPhotoAnalysisRequest = {
  imageUrl: string;
  householdId?: string;
  hint?: string;
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
  tags: string[];
  confidence: number;
  warnings: string[];
  cropBox: PantryPhotoCropBox;
  summary: string;
  householdId?: string;
  householdName?: string;
  source: 'ark';
  model?: string;
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

export function deletePantryItem(token: string, id: string, householdId?: string) {
  return apiRequest<{ id: string }>(
    buildHouseholdPath(`/life-trace/pantry/${id}`, householdId),
    token,
    {
      method: 'DELETE',
    },
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
