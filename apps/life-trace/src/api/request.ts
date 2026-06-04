import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
};

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 350;

export type ApiRequestInit = RequestInit & {
  suppressErrorToast?: boolean;
  errorToastMessage?: string;
  retryOnTransientFailure?: boolean;
  transientRetryDelayMs?: number;
};

function showErrorToast(message: string, init: ApiRequestInit) {
  if (init.suppressErrorToast) {
    return;
  }

  useFeedbackToastStore.getState().showToast(init.errorToastMessage || message, 'error', 3200);
}

function isAuthDependencyMessage(message: string) {
  return message.includes('认证服务暂时不可用') || message.includes('暂时无法验证登录状态');
}

function isNetworkFailureMessage(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized === 'load failed' ||
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('network request failed')
  );
}

function resolveNetworkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (!message || isNetworkFailureMessage(message)) {
    return '网络连接失败，请检查网络后重试';
  }
  return message;
}

function resolveRequestErrorMessage(status?: number, backendMessage?: string) {
  if (backendMessage && isAuthDependencyMessage(backendMessage)) {
    return '云端登录校验暂时不可用，请重新加载重试';
  }
  if (backendMessage) {
    return backendMessage;
  }

  if (status === 401) return '登录状态已失效，请重新登录';
  if (status === 403) return '没有权限执行此操作';
  if (status === 404) return '请求的内容不存在';
  if (status === 500) return '服务器内部错误';
  if (status === 502) return '网关错误，请稍后重试';
  if (status === 503) return '云端服务暂时不可用，请稍后重试';
  if (status === 504) return '云端响应超时，请稍后重试';
  if (status && status >= 500) return '服务端发生错误，请稍后重试';
  return '请求失败，请稍后重试';
}

function getRequestMethod(init: RequestInit) {
  return (init.method || 'GET').toUpperCase();
}

function shouldRetryTransientFailure(init: ApiRequestInit, attempt: number, status?: number) {
  if (attempt > 0 || init.retryOnTransientFailure === false) {
    return false;
  }

  const method = getRequestMethod(init);
  const retryableMethod = method === 'GET' || method === 'HEAD';
  if (!retryableMethod || init.body) {
    return false;
  }

  return status === undefined || status === 502 || status === 503 || status === 504;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

export async function apiRequest<T>(path: string, token: string, init: ApiRequestInit = {}) {
  const {
    suppressErrorToast,
    errorToastMessage,
    retryOnTransientFailure,
    transientRetryDelayMs,
    ...requestInit
  } = init;
  const requestOptions = { suppressErrorToast, errorToastMessage };
  const headers = new Headers(requestInit.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${token}`);

  const isFormData = typeof FormData !== 'undefined' && requestInit.body instanceof FormData;
  if (requestInit.body && !headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  const retryOptions = {
    ...requestInit,
    retryOnTransientFailure,
    transientRetryDelayMs,
  };
  const retryDelayMs = transientRetryDelayMs ?? DEFAULT_TRANSIENT_RETRY_DELAY_MS;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...requestInit,
        headers,
        credentials: 'include',
      });
    } catch (error) {
      if (shouldRetryTransientFailure(retryOptions, attempt)) {
        await wait(retryDelayMs);
        continue;
      }

      const message = resolveNetworkErrorMessage(error);
      showErrorToast(message, requestOptions);
      throw new Error(message);
    }

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok) {
      if (shouldRetryTransientFailure(retryOptions, attempt, response.status)) {
        await wait(retryDelayMs);
        continue;
      }

      const message = resolveRequestErrorMessage(response.status, payload?.message);
      showErrorToast(message, requestOptions);
      throw new Error(message);
    }

    if (!payload) {
      const message = '响应数据为空';
      showErrorToast(message, requestOptions);
      throw new Error(message);
    }

    if (payload.code !== 0) {
      const message = resolveRequestErrorMessage(undefined, payload.message || '请求失败');
      showErrorToast(message, requestOptions);
      throw new Error(message);
    }

    if (payload.data === undefined) {
      const message = '响应数据为空';
      showErrorToast(message, requestOptions);
      throw new Error(message);
    }

    return payload.data;
  }

  const message = '请求失败，请稍后重试';
  showErrorToast(message, requestOptions);
  throw new Error(message);
}
