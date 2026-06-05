import { describe, expect, it } from 'vitest';
import type { PantryPhotoAnalysisResponse } from '../src/api/pantry';
import {
  buildPhotoItemAnalysisSmartSuggestions,
  buildPhotoItemMergedPantryInput,
  buildPhotoItemPantryInput,
  findPhotoItemAnalysisDuplicateCandidates,
  getLatestPhotoItemAnalysisDraft,
  getPhotoItemAnalysisReviewIssues,
  markPhotoItemAnalysisQualityFeedback,
  markPhotoItemAnalysisSaved,
  type PhotoItemAnalysisHistoryItem,
  readPhotoItemAnalysisHistory,
  removePhotoItemAnalysisHistory,
  upsertPhotoItemAnalysisHistory,
} from '../src/lib/photoItemAnalysis';
import type { PantryItem } from '../src/types';

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

const pantryPreferences = {
  defaultReminderEnabled: true,
  defaultReminderRules: ['7d', '3d'] as const,
  defaultReminderTime: '09:00',
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

function createPantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: overrides.id ?? 'pantry-1',
    householdId: overrides.householdId ?? 'household-1',
    name: overrides.name ?? '牛奶',
    category: overrides.category ?? '食品',
    quantity: overrides.quantity ?? 1,
    unit: overrides.unit ?? '盒',
    location: overrides.location ?? '冷藏',
    note: overrides.note ?? '',
    status: overrides.status ?? 'normal',
    reminder: overrides.reminder ?? {
      enabled: false,
      useDefault: true,
      rules: [],
      reminderTime: '09:00',
    },
    createdAt: overrides.createdAt ?? '2026-06-05T01:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-06-05T01:00:00.000Z',
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

  it('marks low confidence analysis fields for review', () => {
    const issues = getPhotoItemAnalysisReviewIssues(
      {
        ...analysis,
        brand: '',
        spec: '',
        confidence: 0.62,
        warnings: ['保质期没有清晰出现在图片中，请手动确认'],
        shelfLifeDays: 180,
      },
      createHistoryItem().form,
    );

    expect(issues.map((issue) => issue.id)).toEqual(['confidence', 'brand', 'spec', 'expiry']);
  });

  it('does not keep showing review issues after the user explicitly dismisses them', () => {
    const issues = getPhotoItemAnalysisReviewIssues(
      {
        ...analysis,
        brand: '',
        spec: '',
        confidence: 0.62,
        warnings: ['保质期没有清晰出现在图片中，请手动确认'],
        shelfLifeDays: 180,
      },
      {
        ...createHistoryItem().form,
        note: '用户复核：品牌未知。\n用户复核：规格不记录。\n用户复核：不记录保质期。',
      },
    );

    expect(issues.map((issue) => issue.id)).toEqual(['confidence']);
  });

  it('stores photo analysis quality feedback without moving the history order', () => {
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
    markPhotoItemAnalysisQualityFeedback('older', 'inaccurate', storage);

    const history = readPhotoItemAnalysisHistory(storage);
    expect(history.map((item) => item.id)).toEqual(['latest', 'older']);
    expect(history[1].qualityFeedback?.rating).toBe('inaccurate');
  });

  it('suggests the preferred pantry household when the draft uses another space', () => {
    const suggestions = buildPhotoItemAnalysisSmartSuggestions({
      analysis,
      form: {
        ...createHistoryItem().form,
        householdId: '',
      },
      pantryItems: [],
      pantryPreferences,
      preferredHouseholdId: 'household-1',
      preferredHouseholdName: '开心家庭',
    });

    expect(suggestions[0]).toMatchObject({
      id: 'household',
      source: 'preference',
      patch: { householdId: 'household-1' },
    });
    expect(suggestions[0].description).toContain('开心家庭');
  });

  it('suggests storage location and unit from related pantry history', () => {
    const suggestions = buildPhotoItemAnalysisSmartSuggestions({
      analysis,
      form: {
        ...createHistoryItem().form,
        householdId: 'household-1',
        location: '厨房',
        unit: '件',
      },
      pantryItems: [
        createPantryItem({ id: 'milk-1', location: '冷藏', unit: '盒' }),
        createPantryItem({ id: 'milk-2', name: '有机牛奶', location: '冷藏', unit: '盒' }),
      ],
      pantryPreferences,
      preferredHouseholdId: 'household-1',
      preferredHouseholdName: '开心家庭',
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toEqual(['location', 'unit']);
    expect(suggestions.map((suggestion) => suggestion.patch)).toEqual([
      { location: '冷藏' },
      { unit: '盒' },
    ]);
  });

  it('ignores used-up and discarded pantry history when building smart suggestions', () => {
    const suggestions = buildPhotoItemAnalysisSmartSuggestions({
      analysis,
      form: {
        ...createHistoryItem().form,
        householdId: 'household-1',
        location: '厨房',
        unit: '件',
      },
      pantryItems: [
        createPantryItem({ id: 'used', location: '冷藏', unit: '盒', status: 'used-up' }),
        createPantryItem({ id: 'discarded', location: '冷藏', unit: '盒', status: 'discarded' }),
      ],
      pantryPreferences,
      preferredHouseholdId: 'household-1',
    });

    expect(suggestions).toEqual([]);
  });

  it('only uses pantry history from the target household for smart suggestions', () => {
    const suggestions = buildPhotoItemAnalysisSmartSuggestions({
      analysis,
      form: {
        ...createHistoryItem().form,
        householdId: 'household-1',
        location: '厨房',
        unit: '件',
      },
      pantryItems: [
        createPantryItem({
          id: 'other-1',
          householdId: 'household-2',
          location: '冷藏',
          unit: '盒',
        }),
        createPantryItem({
          id: 'other-2',
          householdId: 'household-2',
          location: '冷藏',
          unit: '盒',
        }),
      ],
      pantryPreferences,
      preferredHouseholdId: 'household-1',
    });

    expect(suggestions).toEqual([]);
  });

  it('suggests enabling reminders when expiry exists and default reminder is enabled', () => {
    const suggestions = buildPhotoItemAnalysisSmartSuggestions({
      analysis,
      form: {
        ...createHistoryItem().form,
        householdId: 'household-1',
        expiresAt: '2026-06-10',
        reminderEnabled: false,
      },
      pantryItems: [],
      pantryPreferences,
      preferredHouseholdId: 'household-1',
    });

    expect(suggestions.map((suggestion) => suggestion.id)).toContain('reminder');
    expect(suggestions.find((suggestion) => suggestion.id === 'reminder')?.patch).toEqual({
      reminderEnabled: true,
    });
  });

  it('finds duplicate pantry candidates from the same household, location and unit', () => {
    const candidates = findPhotoItemAnalysisDuplicateCandidates({
      analysis,
      form: {
        ...createHistoryItem().form,
        householdId: 'household-1',
        location: '冷藏',
        unit: '盒',
      },
      pantryItems: [
        createPantryItem({ id: 'same', name: '牛奶', location: '冷藏', unit: '盒' }),
        createPantryItem({ id: 'other-location', name: '牛奶', location: '厨房', unit: '盒' }),
        createPantryItem({ id: 'other-unit', name: '牛奶', location: '冷藏', unit: '瓶' }),
      ],
    });

    expect(candidates.map((candidate) => candidate.item.id)).toEqual(['same']);
  });

  it('builds merged pantry input by adding quantity while preserving the existing item fields', () => {
    const merged = buildPhotoItemMergedPantryInput({
      existingItem: createPantryItem({
        id: 'same',
        quantity: 2,
        note: '原有备注',
        reminder: {
          enabled: true,
          useDefault: true,
          rules: ['7d'],
          reminderTime: '09:00',
        },
      }),
      form: {
        ...createHistoryItem().form,
        quantity: '3',
        note: 'AI 新备注',
      },
    });

    expect(merged.quantity).toBe(5);
    expect(merged.note).toContain('原有备注');
    expect(merged.note).toContain('拍照追加：AI 新备注');
    expect(merged.reminder.enabled).toBe(true);
  });
});
