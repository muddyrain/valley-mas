import { describe, expect, it } from 'vitest';
import type { PantryPhotoAnalysisResponse } from '../src/api/pantry';
import {
  buildPhotoItemPantryInput,
  getLatestPhotoItemAnalysisDraft,
  markPhotoItemAnalysisSaved,
  type PhotoItemAnalysisHistoryItem,
  readPhotoItemAnalysisHistory,
  removePhotoItemAnalysisHistory,
  upsertPhotoItemAnalysisHistory,
} from '../src/lib/photoItemAnalysis';

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

const analysis: PantryPhotoAnalysisResponse = {
  name: '牛奶',
  category: '食品',
  quantity: 1,
  unit: '盒',
  storageLocation: '冷藏',
  tags: ['冷藏'],
  confidence: 0.82,
  warnings: [],
  cropBox: { x: 0, y: 0, width: 1, height: 1 },
  summary: '识别为牛奶。',
  source: 'ark',
};

function createHistoryItem(
  overrides: Partial<PhotoItemAnalysisHistoryItem> = {},
): PhotoItemAnalysisHistoryItem {
  return {
    id: overrides.id ?? 'draft-1',
    imageUrl: overrides.imageUrl ?? 'https://example.com/milk.jpg',
    imageName: 'milk.jpg',
    analysis,
    form: {
      name: '牛奶',
      category: '食品',
      quantity: '1',
      unit: '盒',
      location: '冷藏',
      expiresAt: '',
      openedAt: '',
      note: '识别为牛奶。',
      householdId: '',
      reminderEnabled: false,
    },
    status: overrides.status ?? 'draft',
    createdAt: overrides.createdAt ?? '2026-06-05T01:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-05T01:00:00.000Z',
    ...overrides,
  };
}

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

  it('keeps the latest unsaved photo analysis draft for recovery', () => {
    const storage = createStorage();

    upsertPhotoItemAnalysisHistory(
      createHistoryItem({
        id: 'older',
        updatedAt: '2026-06-05T01:00:00.000Z',
      }),
      storage,
    );
    upsertPhotoItemAnalysisHistory(
      createHistoryItem({
        id: 'latest',
        updatedAt: '2026-06-05T02:00:00.000Z',
      }),
      storage,
    );

    const history = readPhotoItemAnalysisHistory(storage);
    expect(history.map((item) => item.id)).toEqual(['latest', 'older']);
    expect(getLatestPhotoItemAnalysisDraft(storage)?.id).toBe('latest');
  });

  it('marks recovered drafts as saved after pantry creation', () => {
    const storage = createStorage();

    upsertPhotoItemAnalysisHistory(createHistoryItem({ id: 'draft-1' }), storage);
    markPhotoItemAnalysisSaved('draft-1', 'pantry-1', storage);

    const saved = readPhotoItemAnalysisHistory(storage)[0];
    expect(saved.status).toBe('saved');
    expect(saved.savedItemId).toBe('pantry-1');
    expect(getLatestPhotoItemAnalysisDraft(storage)).toBeNull();
  });

  it('ignores broken photo analysis history payloads', () => {
    const storage = createStorage();
    storage.setItem('life-trace-photo-item-analysis-history-v1', '{broken json');

    expect(readPhotoItemAnalysisHistory(storage)).toEqual([]);
  });

  it('removes dismissed photo analysis drafts', () => {
    const storage = createStorage();

    upsertPhotoItemAnalysisHistory(createHistoryItem({ id: 'draft-1' }), storage);
    removePhotoItemAnalysisHistory('draft-1', storage);

    expect(readPhotoItemAnalysisHistory(storage)).toEqual([]);
  });
});
