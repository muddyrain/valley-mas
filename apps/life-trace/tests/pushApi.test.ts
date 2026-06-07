import { afterEach, describe, expect, it, vi } from 'vitest';
import { previewDailyBriefPush } from '../src/api/push';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('push api', () => {
  it('requests the daily brief preview payload from the life-trace push endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          title: 'Life Trace 每日天气',
          body: '杭州 22° 多云，今天先把最重要的一件事处理掉；今天计划比较轻，先完成一件最重要的事',
          url: '/today',
          tag: 'life-trace-daily-brief-preview',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const payload = await previewDailyBriefPush(token);

    expect(payload.title).toBe('Life Trace 每日天气');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/push/daily-brief-preview');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });
});
