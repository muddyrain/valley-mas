import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/api/request';
import { useFeedbackToastStore } from '../src/store/useFeedbackToastStore';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
  const activeTimer = useFeedbackToastStore.getState().timer;
  if (activeTimer) {
    globalThis.clearTimeout(activeTimer);
  }
  useFeedbackToastStore.setState({ current: null, timer: null });
});

describe('api request error toast', () => {
  it('shows a global error toast for backend failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          code: 500,
          message: '推送服务未配置',
        }),
      }),
    );

    await expect(apiRequest('/life-trace/push/test', token)).rejects.toThrow('推送服务未配置');

    expect(useFeedbackToastStore.getState().current).toMatchObject({
      message: '推送服务未配置',
      tone: 'error',
    });
  });

  it('can suppress the global error toast for diagnostic flows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          code: 500,
          message: '推送 endpoint 失效',
        }),
      }),
    );

    await expect(
      apiRequest('/life-trace/push/test', token, { suppressErrorToast: true }),
    ).rejects.toThrow('推送 endpoint 失效');

    expect(useFeedbackToastStore.getState().current).toBeNull();
  });

  it('supports overriding the global error toast message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 1,
          message: '原始错误',
        }),
      }),
    );

    await expect(
      apiRequest('/life-trace/settings', token, { errorToastMessage: '设置保存失败' }),
    ).rejects.toThrow('原始错误');

    expect(useFeedbackToastStore.getState().current).toMatchObject({
      message: '设置保存失败',
      tone: 'error',
    });
  });

  it('normalizes Safari fetch failures instead of exposing Load failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Load failed')));

    await expect(
      apiRequest('/life-trace/checkins?date=2026-06-04', token, {
        retryOnTransientFailure: false,
      }),
    ).rejects.toThrow('网络连接失败，请检查网络后重试');

    expect(useFeedbackToastStore.getState().current).toMatchObject({
      message: '网络连接失败，请检查网络后重试',
      tone: 'error',
    });
  });

  it('normalizes auth dependency failures from protected endpoints', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          code: 503,
          message: '认证服务暂时不可用，请稍后重试',
        }),
      }),
    );

    await expect(
      apiRequest('/life-trace/traces', token, {
        retryOnTransientFailure: false,
      }),
    ).rejects.toThrow('云端登录校验暂时不可用，请重新加载重试');

    expect(useFeedbackToastStore.getState().current).toMatchObject({
      message: '云端登录校验暂时不可用，请重新加载重试',
      tone: 'error',
    });
  });

  it('retries transient GET failures once before surfacing an error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          code: 503,
          message: '认证服务暂时不可用，请稍后重试',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { list: [] },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const data = await apiRequest<{ list: unknown[] }>('/life-trace/traces', token, {
      transientRetryDelayMs: 0,
    });

    expect(data.list).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useFeedbackToastStore.getState().current).toBeNull();
  });
});
