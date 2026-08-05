import {
  type ApiResponse,
  type CreateHttpClientOptions,
  createHttpClient,
  type ErrorMessageResolver,
  type RequestConfig,
} from '@valley/shared-request';

type WebHttpClientOptions = Omit<
  CreateHttpClientOptions,
  'baseURL' | 'timeout' | 'withCredentials'
> & {
  baseURL?: string;
  timeout?: number;
  withCredentials?: boolean;
  defaultSuppressErrorToast?: boolean;
};

export type { ApiResponse, CreateHttpClientOptions, ErrorMessageResolver, RequestConfig };

export function createWebHttpClient(
  options: WebHttpClientOptions,
): ReturnType<typeof createHttpClient> {
  const {
    defaultSuppressErrorToast = false,
    baseURL = '/api/v1',
    timeout = 30000,
    withCredentials = true,
    ...createHttpClientOptions
  } = options;

  const http = createHttpClient({
    baseURL,
    timeout,
    withCredentials,
    ...createHttpClientOptions,
  });

  http.interceptors.request.use((config) => {
    const requestConfig = config as typeof config & RequestConfig;
    if (requestConfig.suppressErrorToast === undefined) {
      requestConfig.suppressErrorToast = defaultSuppressErrorToast;
    }
    return requestConfig;
  });

  return http;
}

export { createHttpClient };
