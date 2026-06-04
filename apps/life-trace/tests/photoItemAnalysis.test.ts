import { describe, expect, it } from 'vitest';
import { buildPhotoItemPantryInput } from '../src/lib/photoItemAnalysis';

describe('photo item analysis helpers', () => {
  it('uses the uploaded real photo as the cover source and leaves AI thumbnail empty', () => {
    const input = buildPhotoItemPantryInput({
      form: {
        name: '水杯',
        category: '日用品',
        quantity: '1',
        unit: '个',
        location: '厨房',
        expiresAt: '',
        openedAt: '',
        note: 'AI 识别：水杯',
        householdId: '',
        reminderEnabled: false,
      },
      pantryPreferences: {
        defaultReminderEnabled: true,
        defaultReminderRules: ['7d', '3d'],
        defaultReminderTime: '09:00',
      },
      uploadedImageUrl: 'https://example.com/real-photo.jpg',
    });

    expect(input.imageUrl).toBe('https://example.com/real-photo.jpg');
    expect(input.thumbnailUrl).toBeUndefined();
  });

  it('only enables pantry expiry reminders when an expiry date exists', () => {
    const input = buildPhotoItemPantryInput({
      form: {
        name: '牛奶',
        category: '食品',
        quantity: '1',
        unit: '盒',
        location: '冷藏',
        expiresAt: '2026-06-10',
        openedAt: '',
        note: '生产日期 2026-06-01，保质期 9 天',
        householdId: '',
        reminderEnabled: true,
      },
      pantryPreferences: {
        defaultReminderEnabled: true,
        defaultReminderRules: ['7d', '3d'],
        defaultReminderTime: '09:00',
      },
      uploadedImageUrl: 'https://example.com/milk.jpg',
    });

    expect(input.reminder?.enabled).toBe(true);
    expect(input.reminder?.rules).toEqual(['7d', '3d']);
    expect(input.expiresAt).toBe('2026-06-10');
  });
});
