import type { NewShoppingListItemInput, ShoppingListItem } from '@/types';
import { apiRequest } from './request';

type ShoppingListResponse = {
  householdId?: string;
  householdName?: string;
  list: ShoppingListItem[];
  summary?: { openCount?: number };
};

function buildHouseholdPath(path: string, householdId?: string) {
  if (!householdId) {
    return path;
  }
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}householdId=${encodeURIComponent(householdId)}`;
}

export type ListShoppingOptions = {
  householdId?: string;
  status?: 'open' | 'checked' | 'all';
};

export function listShopping(token: string, options: ListShoppingOptions = {}) {
  const params = new URLSearchParams();
  if (options.status && options.status !== 'all') {
    params.set('status', options.status);
  }
  const search = params.toString();
  const base = search ? `/life-trace/shopping?${search}` : '/life-trace/shopping';
  return apiRequest<ShoppingListResponse>(buildHouseholdPath(base, options.householdId), token);
}

export function createShoppingItem(
  token: string,
  input: NewShoppingListItemInput,
  householdId?: string,
) {
  return apiRequest<ShoppingListItem>(
    buildHouseholdPath('/life-trace/shopping', householdId),
    token,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateShoppingItem(
  token: string,
  id: string,
  input: NewShoppingListItemInput,
  householdId?: string,
) {
  return apiRequest<ShoppingListItem>(
    buildHouseholdPath(`/life-trace/shopping/${id}`, householdId),
    token,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function checkShoppingItem(
  token: string,
  id: string,
  checked: boolean,
  householdId?: string,
) {
  return apiRequest<ShoppingListItem>(
    buildHouseholdPath(`/life-trace/shopping/${id}/check`, householdId),
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ checked }),
    },
  );
}

export function deleteShoppingItem(token: string, id: string, householdId?: string) {
  return apiRequest<{ id: string }>(
    buildHouseholdPath(`/life-trace/shopping/${id}`, householdId),
    token,
    {
      method: 'DELETE',
    },
  );
}
