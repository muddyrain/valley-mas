import { apiRequest } from '@/api/request';
import type { ListPagination, NewPlanInput, Plan, PlanType } from '@/types';

export type ListPlansOptions = {
  page?: number;
  pageSize?: number;
  status?: 'all' | 'open' | 'completed';
  q?: string;
  type?: PlanType | 'all';
  reminder?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

function buildListQuery(options: ListPlansOptions = {}) {
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
  if (options.q?.trim()) {
    params.set('q', options.q.trim());
  }
  if (options.type && options.type !== 'all') {
    params.set('type', options.type);
  }
  if (typeof options.reminder === 'boolean') {
    params.set('reminder', String(options.reminder));
  }
  if (options.dateFrom) {
    params.set('dateFrom', options.dateFrom);
  }
  if (options.dateTo) {
    params.set('dateTo', options.dateTo);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listPlans(token: string, options: ListPlansOptions = {}) {
  return apiRequest<{ list: Plan[]; pagination?: ListPagination }>(
    `/life-trace/plans${buildListQuery(options)}`,
    token,
  );
}

export function createPlan(token: string, input: NewPlanInput) {
  return apiRequest<Plan>('/life-trace/plans', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlan(token: string, id: string, input: NewPlanInput) {
  return apiRequest<Plan>(`/life-trace/plans/${id}`, token, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updatePlanStatus(token: string, id: string, completed: boolean) {
  return apiRequest<Plan>(`/life-trace/plans/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

export function deletePlan(token: string, id: string) {
  return apiRequest<{ id: string }>(`/life-trace/plans/${id}`, token, {
    method: 'DELETE',
  });
}
