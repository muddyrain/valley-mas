import {
  createFetchRequest,
  type ApiResponse as SharedApiResponse,
} from '@valley/shared-fetch-request';

export type ApiResponse<T> = SharedApiResponse<T>;

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

const apiRequestWithOptions = createFetchRequest<ApiError>({
  baseURL: API_BASE_URL,
  showError: () => {},
  createError: (message, _init, context) => new ApiError(message, context?.status),
  resolveNetworkMessage: () => '无法连接到服务器',
  resolveHttpMessage: (_status, payloadMessage) => payloadMessage || '请求失败',
  resolveBusinessMessage: (payload, fallback) => payload.message || fallback,
});

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const headers = new Headers();
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  return apiRequestWithOptions<T>(path, {
    method: options.method,
    headers,
    body: options.body,
    token: options.token,
    // 注意：不启用重试，保持行为一致
    retryOnTransientFailure: false,
  });
}
