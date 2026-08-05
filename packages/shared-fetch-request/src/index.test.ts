import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFetchRequest, isTransientFailure } from './index';

describe('createFetchRequest', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn() as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  test('returns payload data when response code is 0', async () => {
    const response = new Response(
      JSON.stringify({ code: 0, message: 'ok', data: { hello: 'world' } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    const fetchMock = vi.fn().mockResolvedValue(response);
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const request = createFetchRequest({
      baseURL: '/api/v1',
      showError: vi.fn(),
      createError: (message) => new Error(message),
    });

    const data = await request<{ hello: string }>('/ping', {
      token: 'abc',
      method: 'POST',
      body: { hello: 'world' },
    });

    expect(data).toEqual({ hello: 'world' });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestInit = (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;
    const headers = new Headers((requestInit.headers ?? {}) as HeadersInit);
    expect(requestInit.method).toBe('POST');
    expect(headers.get('Accept')).toBe('application/json');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('Authorization')).toBe('Bearer abc');
    expect(requestInit.body).toBe(JSON.stringify({ hello: 'world' }));
  });

  test('throws business error with formatted message', async () => {
    const response = new Response(JSON.stringify({ code: 999, message: '业务失败', data: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    globalThis.fetch = vi.fn().mockResolvedValue(response) as typeof globalThis.fetch;

    const showError = vi.fn();
    const request = createFetchRequest({
      baseURL: '/api/v1',
      showError,
      createError: (message, _, context) =>
        Object.assign(new Error(message), { code: context?.status }),
    });

    await expect(request('/ping')).rejects.toThrow('业务失败');
    expect(showError).toHaveBeenCalledTimes(1);
  });

  test('retries transient failures once by default policy', async () => {
    const responseError = new Response(JSON.stringify({ code: 0, message: 'ok', data: {} }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
    const responseSuccess = new Response(
      JSON.stringify({ code: 0, message: 'ok', data: { done: true } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseError)
      .mockResolvedValueOnce(responseSuccess) as typeof globalThis.fetch;
    globalThis.fetch = fetchMock;

    const request = createFetchRequest({
      baseURL: '/api/v1',
      showError: vi.fn(),
      createError: (message) => new Error(message),
    });

    const data = await request('/ping', {
      method: 'GET',
      retryOnTransientFailure: true,
      transientRetryDelayMs: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data).toEqual({ done: true });
  });

  test('uses export helper isTransientFailure for retry decisions', () => {
    expect(isTransientFailure({ method: 'GET', retryOnTransientFailure: true }, 0, 503)).toBe(true);
    expect(isTransientFailure({ method: 'GET', retryOnTransientFailure: true }, 1, 503)).toBe(
      false,
    );
    expect(isTransientFailure({ method: 'POST', retryOnTransientFailure: true }, 0, 503)).toBe(
      false,
    );
  });
});
