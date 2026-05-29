import { apiRequest } from '@/api/request';
import type { ListPagination, NewPlanInput, Plan } from '@/types';

export type ListPlansOptions = {
  page?: number;
  pageSize?: number;
};

function buildListQuery(options: ListPlansOptions = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set('page', String(options.page));
  }
  if (options.pageSize) {
    params.set('pageSize', String(options.pageSize));
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
