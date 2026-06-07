import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzePantryPhoto,
  consumePantryItem,
  createPantryItem,
  deletePantryItem,
  generatePantryThumbnail,
  listPantry,
  lookupPantryBarcodeMatch,
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

  it('consumes pantry quantities through the consume endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { ...pantryResponse, quantity: 1 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const updated = await consumePantryItem(
      token,
      'pantry-1',
      { action: 'used', quantity: 1 },
      'household-1',
    );

    expect(updated.quantity).toBe(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/life-trace/pantry/pantry-1/consume?householdId=household-1',
    );
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      action: 'used',
      quantity: 1,
    });
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

  it('passes abort signals to pantry photo analysis requests', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          name: '鲜牛奶',
          category: '食品',
          quantity: 1,
          unit: '盒',
          storageLocation: '冷藏',
          tags: ['冷藏'],
          confidence: 0.9,
          warnings: [],
          ocrHints: [],
          householdId: '0',
          source: 'ark',
          model: 'ep-vision',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await analyzePantryPhoto(
      token,
      {
        imageUrl: 'https://example.com/milk.jpg',
        householdId: 'household-1',
      },
      { signal: controller.signal },
    );

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/life-trace/ai/pantry-photo-analysis');
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('looks up pantry barcode matches with encoded query params', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          matched: true,
          source: 'pantry-history',
          matchedItemId: 'pantry-1',
          householdId: 'household-1',
          name: '植护抽纸',
          category: '日用品',
          unit: '包',
          location: '卫生间',
          barcodeValue: '6972205226407',
          barcodeFormat: 'ean_13',
          updatedAt: '2026-06-06T01:00:00.000Z',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupPantryBarcodeMatch(token, {
      barcodeValue: '6972205226407',
      barcodeFormat: 'EAN-13',
      householdId: 'household 1',
    });

    expect(result.matched).toBe(true);
    expect(result.name).toBe('植护抽纸');
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/life-trace/pantry/barcode-match?barcodeValue=6972205226407&barcodeFormat=EAN-13&householdId=household+1',
    );
  });
});
