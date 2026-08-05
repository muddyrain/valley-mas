export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  errorCode?: string;
}

export interface ApiRequestInit extends Omit<RequestInit, 'body'> {
  body?: unknown;
  suppressErrorToast?: boolean;
  errorToastMessage?: string;
  retryOnTransientFailure?: boolean;
  transientRetryDelayMs?: number;
  token?: string | null;
}

export interface FetchRequestRetryContext {
  path: string;
  init: ApiRequestInit;
  attempt: number;
  status?: number;
}

export type FetchErrorContext = {
  status?: number;
  errorCode?: string;
};

export interface CreateFetchRequestOptions<TError extends Error = Error> {
  baseURL: string;
  credentials?: RequestCredentials;
  defaultTransientRetryDelayMs?: number;
  requireResponseData?: boolean;
  shouldRetry?: (context: FetchRequestRetryContext) => boolean;
  parsePayload?: <T>(response: Response) => Promise<ApiResponse<T> | null>;
  resolveNetworkMessage?: (error: unknown, fallback: string) => string;
  resolveHttpMessage?: (
    status: number | undefined,
    payloadMessage: string | undefined,
    fallback: string,
  ) => string;
  resolveBusinessMessage?: (payload: ApiResponse<unknown>, fallback: string) => string;
  resolveEmptyResponseMessage?: () => string;
  showError: (message: string, init: ApiRequestInit) => void;
  createError: (message: string, init: ApiRequestInit, context?: FetchErrorContext) => TError;
}

const DEFAULT_TRANSIENT_RETRY_DELAY_MS = 350;

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

export function isTransientFailure(init: ApiRequestInit, attempt: number, status?: number) {
  if (attempt > 0 || init.retryOnTransientFailure === false) {
    return false;
  }

  const method = (init.method || 'GET').toUpperCase();
  const retryableMethod = method === 'GET' || method === 'HEAD';
  if (!retryableMethod || init.body) {
    return false;
  }

  return status === undefined || status === 502 || status === 503 || status === 504;
}

function defaultResolveNetworkMessage(_error: unknown, fallback: string) {
  return fallback;
}

function defaultResolveHttpMessage(
  _status: number | undefined,
  payloadMessage: string | undefined,
  fallback: string,
) {
  return payloadMessage || fallback;
}

function defaultResolveBusinessMessage(payload: ApiResponse<unknown>, fallback: string) {
  return payload.message || fallback;
}

function defaultParseResponsePayload<T>(response: Response) {
  return response.json().then((payload) => payload as ApiResponse<T> | null);
}

export function createFetchRequest<TError extends Error = Error>(
  options: CreateFetchRequestOptions<TError>,
) {
  const {
    baseURL,
    credentials = 'include',
    defaultTransientRetryDelayMs = DEFAULT_TRANSIENT_RETRY_DELAY_MS,
    shouldRetry = ({ init, attempt, status }) => isTransientFailure(init, attempt, status),
    parsePayload = defaultParseResponsePayload,
    resolveNetworkMessage = defaultResolveNetworkMessage,
    resolveHttpMessage = defaultResolveHttpMessage,
    resolveBusinessMessage = defaultResolveBusinessMessage,
    requireResponseData = false,
    resolveEmptyResponseMessage = () => '请求失败',
    showError,
    createError,
  } = options;

  return async function apiRequest<T>(path: string, requestInit: ApiRequestInit = {}): Promise<T> {
    const {
      suppressErrorToast,
      errorToastMessage,
      retryOnTransientFailure,
      transientRetryDelayMs,
      token,
      headers,
      body,
      ...init
    } = requestInit;

    const normalizedInit: ApiRequestInit = {
      suppressErrorToast,
      errorToastMessage,
      retryOnTransientFailure,
      transientRetryDelayMs,
      token,
      headers,
      body,
      ...init,
    };

    const requestHeaders = new Headers(headers);
    requestHeaders.set('Accept', 'application/json');

    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    if (body && !requestHeaders.has('Content-Type') && !isFormData) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }

    const normalizedBody =
      body === undefined
        ? undefined
        : isFormData || typeof body === 'string'
          ? body
          : JSON.stringify(body);

    const retryDelayMs = transientRetryDelayMs ?? defaultTransientRetryDelayMs;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try {
        response = await fetch(`${baseURL}${path}`, {
          headers: requestHeaders,
          credentials,
          body: normalizedBody as BodyInit | null | undefined,
          ...init,
        });
      } catch (error) {
        if (isAbortError(error, requestInit.signal)) {
          throw error;
        }

        if (shouldRetry({ path, init: normalizedInit, attempt })) {
          await wait(retryDelayMs);
          continue;
        }

        const message = resolveNetworkMessage(error, '网络请求失败，请稍后重试');
        if (!normalizedInit.suppressErrorToast) {
          showError(message, normalizedInit);
        }
        throw createError(message, normalizedInit);
      }

      const payload = await parsePayload<T>(response).catch(() => null);
      if (!response.ok) {
        if (shouldRetry({ path, init: normalizedInit, attempt, status: response.status })) {
          await wait(retryDelayMs);
          continue;
        }

        const message = resolveHttpMessage(response.status, payload?.message, '请求失败');
        if (!normalizedInit.suppressErrorToast) {
          showError(message, normalizedInit);
        }
        throw createError(message, normalizedInit, { status: response.status });
      }

      if (!payload) {
        const message = resolveEmptyResponseMessage();
        if (!normalizedInit.suppressErrorToast) {
          showError(message, normalizedInit);
        }
        throw createError(message, normalizedInit);
      }

      if (payload.code !== 0) {
        const message = resolveBusinessMessage(payload, '请求失败');
        if (!normalizedInit.suppressErrorToast) {
          showError(message, normalizedInit);
        }
        throw createError(message, normalizedInit, {
          status: payload.code,
          errorCode: payload.errorCode,
        });
      }

      if (payload.data === undefined && requireResponseData) {
        const message = resolveEmptyResponseMessage();
        if (!normalizedInit.suppressErrorToast) {
          showError(message, normalizedInit);
        }
        throw createError(message, normalizedInit);
      }

      return payload.data as T;
    }

    const message = '请求失败，请稍后重试';
    if (!normalizedInit.suppressErrorToast) {
      showError(message, normalizedInit);
    }
    throw createError(message, normalizedInit);
  };
}
