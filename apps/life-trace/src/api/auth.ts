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

export type AvatarHistoryItem = {
  id: string;
  avatarUrl: string;
  createdAt: string;
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

  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !headers.has('Content-Type') && !isFormData) {
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

export function updateUserProfile(
  token: string,
  input: {
    nickname?: string;
    avatar?: string;
    email?: string;
    phone?: string;
  },
) {
  return request<LifeTraceUser>(
    '/user/profile',
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
    { token },
  );
}

export function uploadUserAvatar(token: string, formData: FormData) {
  return request<{ avatarUrl: string }>(
    '/user/avatar',
    {
      method: 'POST',
      body: formData,
    },
    { token },
  );
}

export function getUserAvatarHistory(token: string, pageSize = 12) {
  return request<AvatarHistoryItem[]>(`/user/avatar/history?pageSize=${pageSize}`, undefined, {
    token,
  });
}

export function useAvatarHistory(token: string, historyId: string) {
  return request<{ avatarUrl: string }>(
    `/user/avatar/history/${historyId}/use`,
    {
      method: 'POST',
    },
    { token },
  );
}
