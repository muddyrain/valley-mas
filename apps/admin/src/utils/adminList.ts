import type { AdminListResponse } from '@/types/api';

const toPositiveInteger = (value: number | undefined, fallback: number) =>
  Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;

export function matchesKeyword(keyword: string | undefined, values: Array<string | undefined>) {
  const normalizedKeyword = keyword?.trim().toLocaleLowerCase();
  if (!normalizedKeyword) return true;

  return values.some((value) => value?.toLocaleLowerCase().includes(normalizedKeyword));
}

export function paginateLocalList<T>(
  items: T[],
  requestedPage: number | undefined,
  requestedPageSize: number | undefined,
): AdminListResponse<T> {
  const pageSize = toPositiveInteger(requestedPageSize, 20);
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(toPositiveInteger(requestedPage, 1), lastPage);
  const start = (page - 1) * pageSize;

  return {
    list: items.slice(start, start + pageSize),
    total,
    page,
    pageSize,
  };
}
