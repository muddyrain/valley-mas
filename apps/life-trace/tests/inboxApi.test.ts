import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  convertInboxItem,
  createInboxItem,
  deleteInboxItem,
  listInboxItems,
  updateInboxItem,
  updateInboxItemStatus,
} from '../src/api/inbox';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('inbox api', () => {
  it('lists inbox items with filters and bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          list: [
            {
              id: 'item-1',
              title: '读书链接',
              content: '书单资料',
              itemType: 'link',
              linkUrl: 'https://example.com/books',
              tags: ['阅读'],
              status: 'inbox',
            },
          ],
          pagination: { page: 1, pageSize: 10, total: 1, hasMore: false },
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await listInboxItems(token, {
      page: 1,
      pageSize: 10,
      status: 'inbox',
      type: 'link',
      q: '书',
    });

    expect(data.list[0].title).toBe('读书链接');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/inbox?page=1&pageSize=10&status=inbox&type=link&q=%E4%B9%A6',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('creates updates archives converts and deletes inbox items', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { id: 'item-1', title: '收下资料', itemType: 'text', tags: [], status: 'inbox' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            id: 'item-1',
            title: '资料链接',
            itemType: 'link',
            linkUrl: 'https://example.com',
            tags: ['资料'],
            status: 'inbox',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            id: 'item-1',
            title: '资料链接',
            itemType: 'link',
            tags: ['资料'],
            status: 'archived',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: {
            id: 'item-1',
            title: '资料链接',
            itemType: 'link',
            tags: ['资料'],
            status: 'converted',
            convertedType: 'plan',
            convertedId: 'plan-1',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { id: 'item-1' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    await createInboxItem(token, { title: '收下资料', itemType: 'text', tags: [] });
    await updateInboxItem(token, 'item-1', {
      title: '资料链接',
      itemType: 'link',
      linkUrl: 'https://example.com',
      tags: ['资料'],
    });
    await updateInboxItemStatus(token, 'item-1', 'archived');
    await convertInboxItem(token, 'item-1', { convertedType: 'plan', convertedId: 'plan-1' });
    await deleteInboxItem(token, 'item-1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/life-trace/inbox',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ title: '收下资料', itemType: 'text', tags: [] }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/life-trace/inbox/item-1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: '资料链接',
          itemType: 'link',
          linkUrl: 'https://example.com',
          tags: ['资料'],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/life-trace/inbox/item-1/status',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/life-trace/inbox/item-1/convert',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ convertedType: 'plan', convertedId: 'plan-1' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      '/api/v1/life-trace/inbox/item-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
