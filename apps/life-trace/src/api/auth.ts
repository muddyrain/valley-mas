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

export class AuthRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AuthRequestError';
  }
}

export function isConfirmedAuthFailure(error: unknown) {
  return error instanceof AuthRequestError && (error.status === 401 || error.status === 403);
}

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

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok) {
    throw new AuthRequestError(payload?.message || `请求失败：${response.status}`, response.status);
  }

  if (!payload) {
    throw new AuthRequestError('响应数据为空');
  }

  if (payload.code !== 0) {
    throw new AuthRequestError(payload.message || '请求失败', payload.code);
  }

  if (payload.data === undefined) {
    throw new AuthRequestError('响应数据为空');
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
