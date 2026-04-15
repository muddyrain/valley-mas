import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface RequestConfig extends AxiosRequestConfig {
  skipAuth?: boolean;
  suppressErrorToast?: boolean;
}

type ErrorContext = {
  requestConfig?: RequestConfig;
  rawError: unknown;
};

export type ErrorMessageResolver = (error: unknown, fallback: string) => string;

export interface CreateHttpClientOptions {
  baseURL: string;
  timeout: number;
  withCredentials: boolean;
  getToken?: () => string | null | undefined;
  clearAuth?: () => void;
  redirectToLogin?: () => void;
  showError: (message: string, context: ErrorContext) => void;
  resolveErrorMessage?: ErrorMessageResolver;
}

function defaultResolveErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ message?: string }>;
  const status = axiosError.response?.status;

  if (status === 401) return '认证失败，请重新登录';
  if (status === 403) return '您没有权限执行此操作';
  if (status === 404) return '请求的资源不存在';
  if (status === 500) return '服务器内部错误';
  if (status === 502) return '网关错误';
  if (status === 503) return '服务暂时不可用';
  if (status && status >= 500) return '服务端发生错误';

  if (!status) {
    if (axiosError.code === 'ECONNABORTED') return '请求超时，请检查网络连接';
    if (axiosError.code === 'ERR_NETWORK') return '网络连接失败，请检查网络';
    return '网络请求失败，请稍后重试';
  }

  return fallback;
}

export function createHttpClient(options: CreateHttpClientOptions): AxiosInstance {
  const {
    baseURL,
    timeout,
    withCredentials,
    getToken,
    clearAuth,
    redirectToLogin,
    showError,
    resolveErrorMessage = defaultResolveErrorMessage,
  } = options;

  const http = axios.create({
    baseURL,
    timeout,
    withCredentials,
  });

  http.interceptors.request.use(
    (config) => {
      const requestConfig = config as typeof config & RequestConfig;
      if (requestConfig.skipAuth) {
        if (requestConfig.headers?.Authorization) {
          delete requestConfig.headers.Authorization;
        }
        return requestConfig;
      }

      const token = getToken?.();
      if (token) {
        requestConfig.headers.Authorization = `Bearer ${token}`;
      }
      return requestConfig;
    },
    (error) => {
      const requestConfig = (error as { config?: RequestConfig }).config;
      if (!requestConfig?.suppressErrorToast) {
        showError('请求失败，请稍后重试', { requestConfig, rawError: error });
      }
      return Promise.reject(error);
    },
  );

  http.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      const { code, message: msg, data } = response.data;
      if (code !== 0) {
        if (code === 401) {
          clearAuth?.();
          redirectToLogin?.();
        }
        showError(msg || '请求失败', {
          requestConfig: response.config as RequestConfig,
          rawError: new Error(msg || 'Error'),
        });
        return Promise.reject(new Error(msg || 'Error'));
      }
      return data as typeof response;
    },
    (error: AxiosError<{ message?: string }>) => {
      const requestConfig = error.config as RequestConfig | undefined;

      if (error.response?.status === 401) {
        clearAuth?.();
        redirectToLogin?.();
      }

      const backendMessage = error.response?.data?.message;
      const fallback = backendMessage || error.message || '请求失败';
      const message = resolveErrorMessage(error, fallback);

      if (!requestConfig?.suppressErrorToast) {
        showError(message, { requestConfig, rawError: error });
      }

      return Promise.reject(error);
    },
  );

  return http;
}
