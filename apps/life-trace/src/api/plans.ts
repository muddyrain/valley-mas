import { apiRequest } from '@/api/request';
import type { NewPlanInput, Plan } from '@/types';

export function listPlans(token: string) {
  return apiRequest<{ list: Plan[] }>('/life-trace/plans', token);
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
