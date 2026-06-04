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
});
