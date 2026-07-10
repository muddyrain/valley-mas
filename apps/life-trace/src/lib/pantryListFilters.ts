import type { ListPantryOptions } from '@/api/pantry';
import type { PantryListCategoryFilter, PantryListStatusFilter, PantrySortMode } from '@/types';

export type PantryListFilters = {
  status: PantryListStatusFilter;
  category: PantryListCategoryFilter;
  includeExpired: boolean;
  sort: PantrySortMode;
  q: string;
};

type PantryListFilterDefaults = Pick<PantryListFilters, 'includeExpired' | 'sort'>;

export const pantryQuickStatuses = ['all', 'expiring', 'expired'] as const;
export const pantryDetailedStatuses = ['normal', 'expiring', 'no-expiry', 'kept'] as const;
export const pantryHistoryStatuses = ['used-up', 'discarded'] as const;
export const pantryCategoryFilters: PantryListCategoryFilter[] = [
  'all',
  '食品',
  '日用品',
  '药品',
  '宠物',
  '其他',
];
export const pantrySortOptions: Array<{ id: PantrySortMode; label: string }> = [
  { id: 'expiry-asc', label: '临期优先' },
  { id: 'created-desc', label: '录入时间' },
  { id: 'expiry-desc', label: '保质期最长' },
];

const pantryStatusFilters: PantryListStatusFilter[] = [
  'all',
  ...pantryDetailedStatuses,
  ...pantryHistoryStatuses,
];

function readStatus(value: string | null): PantryListStatusFilter {
  return pantryStatusFilters.includes(value as PantryListStatusFilter)
    ? (value as PantryListStatusFilter)
    : 'all';
}

function readCategory(value: string | null): PantryListCategoryFilter {
  return pantryCategoryFilters.includes(value as PantryListCategoryFilter)
    ? (value as PantryListCategoryFilter)
    : 'all';
}

function readSort(value: string | null, fallback: PantrySortMode): PantrySortMode {
  return pantrySortOptions.some((option) => option.id === value)
    ? (value as PantrySortMode)
    : fallback;
}

export function readPantryListFilters(
  params: URLSearchParams,
  defaults: PantryListFilterDefaults,
): PantryListFilters {
  return {
    status: readStatus(params.get('status')),
    category: readCategory(params.get('category')),
    includeExpired:
      params.get('includeExpired') === 'true' ||
      (!params.has('includeExpired') && defaults.includeExpired),
    sort: readSort(params.get('sort'), defaults.sort),
    q: params.get('q')?.trim() ?? '',
  };
}

export function buildPantryListSearchParams(filters: PantryListFilters) {
  const params = new URLSearchParams();
  if (filters.status !== 'all') {
    params.set('status', filters.status);
  }
  if (filters.category !== 'all') {
    params.set('category', filters.category);
  }
  if (filters.status === 'all' && filters.includeExpired) {
    params.set('includeExpired', 'true');
  }
  if (filters.sort !== 'expiry-asc') {
    params.set('sort', filters.sort);
  }
  const q = filters.q.trim();
  if (q) {
    params.set('q', q);
  }
  return params;
}

export function toPantryListApiOptions(filters: PantryListFilters): ListPantryOptions {
  return {
    status: filters.status,
    category: filters.category,
    sort: filters.sort,
    q: filters.q.trim() || undefined,
    ...(filters.status === 'all' ? { includeExpired: filters.includeExpired } : {}),
  };
}

export function isSamePantryListQuery(left: ListPantryOptions, right: ListPantryOptions) {
  const leftStatus = left.status ?? 'all';
  const rightStatus = right.status ?? 'all';
  return (
    left.householdId?.trim() === right.householdId?.trim() &&
    leftStatus === rightStatus &&
    (left.category ?? 'all') === (right.category ?? 'all') &&
    (left.sort ?? 'expiry-asc') === (right.sort ?? 'expiry-asc') &&
    (left.q?.trim() ?? '') === (right.q?.trim() ?? '') &&
    (leftStatus === 'all' ? Boolean(left.includeExpired) : false) ===
      (rightStatus === 'all' ? Boolean(right.includeExpired) : false)
  );
}

export function getPantryRefreshPageSize(
  requestedPageSize: number,
  loadedItemCount: number,
  sameQuery: boolean,
) {
  return sameQuery ? Math.max(requestedPageSize, loadedItemCount) : requestedPageSize;
}
