import { getLifeTraceErrorMessage, getLifeTraceHttpErrorMessage } from '@/lib/error';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';

type ApiEnvelope<T> = {
  code: number;
  message: string;
  data?: T;
  errorCode?: string;
};

export const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 350;

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

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

function isAbortError(error: unknown, signal?: AbortSignal | null) {
  if (signal?.aborted) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return error.name === 'AbortError' || message.includes('abort') || message.includes('aborted');
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
      if (isAbortError(error, requestInit.signal)) {
        throw error;
      }

      if (shouldRetryTransientFailure(retryOptions, attempt)) {
        await wait(retryDelayMs);
        continue;
      }

      const message = getLifeTraceErrorMessage(error, '网络连接失败，请检查网络后重试');
      showErrorToast(message, requestOptions);
      throw new ApiRequestError(message);
    }

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
    if (!response.ok) {
      if (shouldRetryTransientFailure(retryOptions, attempt, response.status)) {
        await wait(retryDelayMs);
        continue;
      }

      const message = getLifeTraceHttpErrorMessage(response.status, payload?.message);
      showErrorToast(message, requestOptions);
      throw new ApiRequestError(message, payload?.errorCode);
    }

    if (!payload) {
      const message = '响应数据为空';
      showErrorToast(message, requestOptions);
      throw new ApiRequestError(message);
    }

    if (payload.code !== 0) {
      const message = getLifeTraceHttpErrorMessage(undefined, payload.message || '请求失败');
      showErrorToast(message, requestOptions);
      throw new ApiRequestError(message, payload.errorCode);
    }

    if (payload.data === undefined) {
      const message = '响应数据为空';
      showErrorToast(message, requestOptions);
      throw new ApiRequestError(message);
    }

    return payload.data;
  }

  const message = '请求失败，请稍后重试';
  showErrorToast(message, requestOptions);
  throw new ApiRequestError(message);
}
