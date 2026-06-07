import { describe, expect, it, vi } from 'vitest';
import type { RecipeSuggestionItem } from '../src/api/advice';
import { createPlanFromRecipe } from '../src/lib/recipePlan';

function createRecipe(fields: Partial<RecipeSuggestionItem> = {}): RecipeSuggestionItem {
  return {
    id: 'recipe-1',
    title: '番茄炒蛋',
    reason: '番茄临期，搭配鸡蛋最快手。',
    usedItems: ['番茄', '鸡蛋'],
    missingItems: [],
    timeMinutes: 15,
    difficulty: '简单',
    servings: 2,
    steps: ['番茄切块', '鸡蛋炒散', '合炒调味'],
    tags: ['临期优先'],
    planTitle: '晚餐做番茄炒蛋',
    planNote: '优先用掉临期番茄，做完后确认库存消耗。',
    ...fields,
  };
}

describe('createPlanFromRecipe', () => {
  it('turns a recipe suggestion into a dinner plan without consuming pantry automatically', () => {
    vi.setSystemTime(new Date('2026-06-07T10:30:00+08:00'));

    const plan = createPlanFromRecipe(createRecipe());

    expect(plan).toMatchObject({
      title: '晚餐做番茄炒蛋',
      type: '吃饭',
      timeLabel: '今天 19:00',
      scheduledDate: '2026-06-07',
      scheduledTime: '19:00',
      timezone: 'Asia/Shanghai',
      reminder: true,
      source: 'ai_advice',
    });
    expect(plan.note).toContain('做完后确认库存消耗');
    expect(plan.note).toContain('消耗库存：番茄、鸡蛋。');
  });

  it('falls back to the recipe title and actual ingredient confirmation', () => {
    vi.setSystemTime(new Date('2026-06-07T10:30:00+08:00'));

    const plan = createPlanFromRecipe(
      createRecipe({
        planTitle: '',
        usedItems: [],
      }),
    );

    expect(plan.title).toBe('番茄炒蛋');
    expect(plan.note).toContain('消耗库存：按实际食材确认。');
  });
});
