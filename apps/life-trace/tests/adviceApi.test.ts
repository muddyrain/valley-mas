import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateTodayAdvice } from '../src/api/advice';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('advice api', () => {
  it('generates today advice with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          summary: '今天先完成一件轻量计划。',
          list: [{ id: 'plan', title: '今日计划', detail: '先做最轻的一件', tone: 'alert' }],
          source: 'ark',
          model: 'ep-test',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await generateTodayAdvice(token);

    expect(data.summary).toContain('轻量计划');
    expect(data.list[0].id).toBe('plan');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/ai/today-advice',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });
});
