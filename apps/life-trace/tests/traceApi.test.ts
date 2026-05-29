import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTrace, deleteTrace, listTraces, updateTrace } from '../src/api/traces';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('trace api', () => {
  it('lists traces with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { list: [{ id: '1', title: '散步', tags: ['生活迹'] }] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await listTraces(token);

    expect(data.list[0].title).toBe('散步');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/traces',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('creates, updates and deletes traces through the life-trace endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { id: 'trace-1', title: '晚饭', tags: ['计划完成'] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { id: 'trace-1', title: '晚饭散步', tags: ['计划完成', '散步'] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { id: 'trace-1' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const trace = await createTrace(token, {
      title: '晚饭',
      summary: '吃得很好',
      timeLabel: '今天 19:30',
      mood: '满足',
      tags: ['计划完成'],
      source: '计划',
    });
    const updated = await updateTrace(token, 'trace-1', {
      title: '晚饭散步',
      summary: '饭后走了一会儿',
      timeLabel: '今天 20:10',
      mood: '放松',
      tags: ['计划完成', '散步'],
      source: '计划',
    });
    await deleteTrace(token, 'trace-1');

    expect(trace.id).toBe('trace-1');
    expect(updated.title).toBe('晚饭散步');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/traces');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/life-trace/traces/trace-1');
    expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/life-trace/traces/trace-1');
    expect(fetchMock.mock.calls[2][1].method).toBe('DELETE');
  });
});
