import { describe, expect, it } from 'vitest';
import {
  buildPantryTraceInput,
  generatePantryThumbnailDataUrl,
  getPantryCoverUrl,
  getPantryDaysUntilExpiry,
  getPantryExpiryText,
  getPantryPersistedStatus,
  resolvePantryStatus,
  sortPantryItems,
} from '../src/lib/pantry';
import type { PantryItem } from '../src/types';

function createItem(id: string, fields: Partial<PantryItem> = {}): PantryItem {
  return {
    id,
    name: id,
    category: '食品',
    quantity: 1,
    unit: '件',
    location: '冷藏',
    note: '',
    status: 'normal',
    reminder: {
      enabled: true,
      useDefault: true,
      rules: ['7d', '3d', 'same-day', 'expired'],
      reminderTime: '09:00',
    },
    ...fields,
  };
}

describe('pantry helpers', () => {
  const now = new Date(2026, 5, 2, 10, 0, 0);

  it('resolves expiring and expired statuses from expiry date', () => {
    const expiring = createItem('milk', { expiresAt: '2026-06-05' });
    const expired = createItem('salad', { expiresAt: '2026-06-01' });

    expect(getPantryDaysUntilExpiry(expiring, now)).toBe(3);
    expect(resolvePantryStatus(expiring, now)).toBe('expiring');
    expect(resolvePantryStatus(expired, now)).toBe('expired');
  });

  it('keeps used-up and discarded states stable', () => {
    const usedUp = createItem('used', { status: 'used-up', expiresAt: '2026-06-10' });
    const discarded = createItem('discarded', { status: 'discarded', expiresAt: '2026-06-10' });

    expect(resolvePantryStatus(usedUp, now)).toBe('used-up');
    expect(resolvePantryStatus(discarded, now)).toBe('discarded');
  });

  it('only persists manual terminal statuses when editing pantry items', () => {
    expect(getPantryPersistedStatus('used-up')).toBe('used-up');
    expect(getPantryPersistedStatus('discarded')).toBe('discarded');
    expect(getPantryPersistedStatus('normal')).toBe('normal');
    expect(getPantryPersistedStatus('expiring')).toBe('normal');
    expect(getPantryPersistedStatus('expired')).toBe('normal');
  });

  it('builds cover fallback from real image to thumbnail', () => {
    const real = createItem('real', { imageUrl: 'https://example.com/real.jpg' });
    const ai = createItem('ai', { thumbnailUrl: 'data:image/svg+xml,abc' });

    expect(getPantryCoverUrl(real)).toBe('https://example.com/real.jpg');
    expect(getPantryCoverUrl(ai)).toBe('data:image/svg+xml,abc');
  });

  it('sorts expired items before expiring ones', () => {
    const items = sortPantryItems(
      [
        createItem('normal', { expiresAt: '2026-06-20' }),
        createItem('expiring', { expiresAt: '2026-06-04' }),
        createItem('expired', { expiresAt: '2026-05-31' }),
      ],
      now,
    );

    expect(items.map((item) => item.id)).toEqual(['expired', 'expiring', 'normal']);
  });

  it('describes expiry text and generates a thumbnail data url', () => {
    const item = createItem('yogurt', { name: '酸奶', expiresAt: '2026-06-02' });
    const thumbnail = generatePantryThumbnailDataUrl('酸奶', '食品');

    expect(getPantryExpiryText(item, now)).toBe('今天到期');
    expect(thumbnail).toContain('data:image/svg+xml');
    expect(thumbnail.length).toBeGreaterThan(800);
  });

  it('builds a trace payload for pantry actions', () => {
    const item = createItem('milk', {
      name: '牛奶',
      location: '冷藏',
      imageUrl: 'https://example.com/milk.jpg',
    });
    const trace = buildPantryTraceInput(item, 'used-up', now);

    expect(trace.title).toContain('已用完');
    expect(trace.location).toBe('冷藏');
    expect(trace.imageUrl).toBe('https://example.com/milk.jpg');
    expect(trace.tags).toContain('家庭库存');
  });
});
