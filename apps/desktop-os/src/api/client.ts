export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1';

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('无法连接到服务器');
  }

  let payload: Partial<ApiResponse<T>> | null = null;
  try {
    payload = (await response.json()) as Partial<ApiResponse<T>>;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || '请求失败', response.status);
  }

  if (payload?.code !== 0) {
    throw new ApiError(payload?.message || '请求失败', payload?.code);
  }

  return payload.data as T;
}
