import type { NewPlanInput, Plan } from '@/types';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function request<T>(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`请求失败：${response.status}`);
  }

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (payload.code !== 0) {
    throw new Error(payload.message || '请求失败');
  }

  if (payload.data === undefined) {
    throw new Error('响应数据为空');
  }

  return payload.data;
}

export function listPlans(token: string) {
  return request<{ list: Plan[] }>('/life-trace/plans', token);
}

export function createPlan(token: string, input: NewPlanInput) {
  return request<Plan>('/life-trace/plans', token, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePlanStatus(token: string, id: string, completed: boolean) {
  return request<Plan>(`/life-trace/plans/${id}/status`, token, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

export function deletePlan(token: string, id: string) {
  return request<{ id: string }>(`/life-trace/plans/${id}`, token, {
    method: 'DELETE',
  });
}
