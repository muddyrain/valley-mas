export type LifeTraceUser = {
  id: string | number;
  username: string;
  nickname: string;
  avatar?: string;
  role: string;
  email?: string;
  phone?: string;
};

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
};

type LoginResponse = {
  token: string;
  userInfo: LifeTraceUser;
};

type RequestOptions = {
  token?: string | null;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function request<T>(path: string, init: RequestInit = {}, options: RequestOptions = {}) {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
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

export function loginWithPassword(input: { email: string; password: string }) {
  return request<LoginResponse>('/login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      loginType: 'password',
    }),
  });
}

export function getCurrentUser(token: string) {
  return request<LifeTraceUser>('/user/current', undefined, { token });
}

export function logout(token: string | null) {
  return request<{ message: string }>('/logout', { method: 'POST' }, { token });
}
