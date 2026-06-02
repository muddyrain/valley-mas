import { apiRequest } from '@/api/request';
import type { ListPagination, NewPantryItemInput, PantryItem, PantryItemStatus } from '@/types';

export type ListPantryOptions = {
  page?: number;
  pageSize?: number;
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

function buildListQuery(options: ListPantryOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
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
  return apiRequest<{ list: PantryItemResponse[]; pagination?: ListPagination }>(
    `/life-trace/pantry${buildListQuery(options)}`,
    token,
  ).then((data) => ({
    ...data,
    list: data.list.map(deserializePantryItem),
  }));
}

export function createPantryItem(token: string, input: NewPantryItemInput) {
  return apiRequest<PantryItemResponse>('/life-trace/pantry', token, {
    method: 'POST',
    body: JSON.stringify(serializePantryItemInput(input)),
  }).then(deserializePantryItem);
}

export function updatePantryItem(token: string, id: string, input: NewPantryItemInput) {
  return apiRequest<PantryItemResponse>(`/life-trace/pantry/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(serializePantryItemInput(input)),
  }).then(deserializePantryItem);
}

export function updatePantryItemStatus(token: string, id: string, status: PantryItemStatus) {
  return apiRequest<PantryItemResponse>(`/life-trace/pantry/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then(deserializePantryItem);
}

export function deletePantryItem(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/pantry/${id}`, token, {
    method: 'DELETE',
  });
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
