import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPantryItem,
  deletePantryItem,
  generatePantryThumbnail,
  listPantry,
  updatePantryItem,
  updatePantryItemStatus,
} from '../src/api/pantry';

const token = 'test-token';

const pantryResponse = {
  id: 'pantry-1',
  name: '牛奶',
  category: '食品',
  quantity: 2,
  unit: '盒',
  location: '冷藏',
  expiresAt: '2026-06-04',
  openedAt: '2026-06-01',
  note: '早餐先喝',
  imageUrl: 'https://example.com/milk.jpg',
  thumbnailUrl: 'data:image/svg+xml;base64,abc',
  status: 'normal',
  reminderEnabled: true,
  reminderUseDefault: false,
  reminderRules: ['3d', 'same-day'],
  reminderTime: '08:30',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pantry api', () => {
  it('maps pantry reminder fields between API payloads and app shape', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { list: [pantryResponse] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: pantryResponse,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { ...pantryResponse, status: 'used-up' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          message: 'success',
          data: { id: 'pantry-1' },
        }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const listed = await listPantry(token, { status: 'all' });
    const created = await createPantryItem(token, {
      name: '牛奶',
      category: '食品',
      quantity: 2,
      unit: '盒',
      location: '冷藏',
      expiresAt: '2026-06-04',
      openedAt: '2026-06-01',
      note: '早餐先喝',
      imageUrl: 'https://example.com/milk.jpg',
      thumbnailUrl: 'data:image/svg+xml;base64,abc',
      status: 'normal',
      reminder: {
        enabled: true,
        useDefault: false,
        rules: ['3d', 'same-day'],
        reminderTime: '08:30',
      },
    });
    const updated = await updatePantryItemStatus(token, 'pantry-1', 'used-up');
    await deletePantryItem(token, 'pantry-1');

    expect(listed.list[0].reminder.rules).toEqual(['3d', 'same-day']);
    expect(created.reminder.reminderTime).toBe('08:30');
    expect(updated.status).toBe('used-up');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/pantry');
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(fetchMock.mock.calls[2][0]).toBe('/api/v1/life-trace/pantry/pantry-1/status');
    expect(fetchMock.mock.calls[3][1].method).toBe('DELETE');

    const createBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(createBody.reminder).toEqual({
      enabled: true,
      useDefault: false,
      rules: ['3d', 'same-day'],
      reminderTime: '08:30',
    });
  });

  it('updates pantry items through the pantry endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { ...pantryResponse, note: '改成今晚喝掉' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await updatePantryItem(token, 'pantry-1', {
      name: '牛奶',
      category: '食品',
      quantity: 1,
      unit: '盒',
      location: '冷藏',
      expiresAt: '2026-06-04',
      openedAt: '2026-06-01',
      note: '改成今晚喝掉',
      imageUrl: '',
      thumbnailUrl: '',
      status: 'normal',
      reminder: {
        enabled: true,
        useDefault: true,
        rules: ['7d', '3d', 'same-day', 'expired'],
        reminderTime: '09:00',
      },
    });

    expect(updated.note).toBe('改成今晚喝掉');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/pantry/pantry-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
  });

  it('generates pantry thumbnails through the AI endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          thumbnailUrl: 'https://cdn.example.com/pantry-thumb.jpg',
          source: 'ark',
          model: 'ep-image',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await generatePantryThumbnail(token, {
      name: '鲜牛奶',
      category: '食品',
      location: '冷藏',
      note: '早餐优先喝掉',
    });

    expect(result.thumbnailUrl).toBe('https://cdn.example.com/pantry-thumb.jpg');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/ai/pantry-thumbnail');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      name: '鲜牛奶',
      category: '食品',
      location: '冷藏',
      note: '早餐优先喝掉',
    });
  });
});
