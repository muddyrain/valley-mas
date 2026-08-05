import { describe, expect, test, vi } from 'vitest';
import { createWebHttpClient } from './index';

describe('createWebHttpClient', () => {
  test('injects default suppressErrorToast when not set', async () => {
    const showError = vi.fn();
    const getToken = vi.fn(() => 'token');

    const http = createWebHttpClient({
      baseURL: '/api/v1',
      timeout: 30000,
      withCredentials: true,
      showError,
      getToken,
      clearAuth: vi.fn(),
      redirectToLogin: vi.fn(),
      defaultSuppressErrorToast: true,
    });

    const reqInterceptors = http.interceptors.request.handlers
      .map((item) => item.fulfilled)
      .filter(Boolean) as Array<(config: unknown) => unknown>;

    let config = { headers: {} } as {
      headers: Record<string, unknown>;
      suppressErrorToast?: boolean;
    };
    for (const interceptor of reqInterceptors) {
      // eslint-disable-next-line no-await-in-loop
      config = (await interceptor(config)) as typeof config;
    }

    expect(config.suppressErrorToast).toBe(true);
    expect(config.headers.Authorization).toBe('Bearer token');
    expect(config.headers.Authorization).not.toBeUndefined();
    expect(getToken).toHaveBeenCalledTimes(1);
    expect(showError).toHaveBeenCalledTimes(0);
  });

  test('keeps suppressErrorToast unset when default is false', async () => {
    const http = createWebHttpClient({
      baseURL: '/api/v1',
      timeout: 30000,
      withCredentials: true,
      showError: vi.fn(),
      getToken: vi.fn(() => null),
      clearAuth: vi.fn(),
      redirectToLogin: vi.fn(),
      defaultSuppressErrorToast: false,
    });

    const reqInterceptors = http.interceptors.request.handlers
      .map((item) => item.fulfilled)
      .filter(Boolean) as Array<(config: unknown) => unknown>;

    let config = { headers: {} } as {
      headers: Record<string, unknown>;
      suppressErrorToast?: boolean;
    };
    for (const interceptor of reqInterceptors) {
      // eslint-disable-next-line no-await-in-loop
      config = (await interceptor(config)) as typeof config;
    }

    expect(config.suppressErrorToast).toBeUndefined();
  });
});
