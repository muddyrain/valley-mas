import { apiRequest } from '@/api/request';
import type {
  LedgerCategory,
  LedgerDirection,
  LedgerEntry,
  LedgerSummary,
  ListPagination,
  NewLedgerEntryInput,
} from '@/types';

export type ListLedgerOptions = {
  page?: number;
  pageSize?: number;
  month?: string;
  category?: LedgerCategory | 'all';
  direction?: LedgerDirection | 'all';
};

function buildLedgerQuery(options: ListLedgerOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
  }
  if (options.month) {
    params.set('month', options.month);
  }
  if (options.category && options.category !== 'all') {
    params.set('category', options.category);
  }
  if (options.direction && options.direction !== 'all') {
    params.set('direction', options.direction);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listLedgerEntries(token: string, options: ListLedgerOptions = {}) {
  return apiRequest<{ list: LedgerEntry[]; summary: LedgerSummary; pagination?: ListPagination }>(
    `/life-trace/ledger${buildLedgerQuery(options)}`,
    token,
  );
}

export function createLedgerEntry(token: string, input: NewLedgerEntryInput) {
  return apiRequest<LedgerEntry>('/life-trace/ledger', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateLedgerEntry(token: string, id: string, input: NewLedgerEntryInput) {
  return apiRequest<LedgerEntry>(`/life-trace/ledger/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteLedgerEntry(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/ledger/${id}`, token, {
    method: 'DELETE',
  });
}
