type ApiEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
};

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function apiRequest<T>(path: string, token: string, init: RequestInit = {}) {
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
