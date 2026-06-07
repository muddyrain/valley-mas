import type { RecipeSuggestionItem } from '@/api/advice';
import { getLocalISODate } from '@/lib/planSchedule';
import type { NewPlanInput } from '@/types';

export function createPlanFromRecipe(recipe: RecipeSuggestionItem): NewPlanInput {
  return {
    title: recipe.planTitle || recipe.title,
    type: '吃饭',
    timeLabel: '今天 19:00',
    scheduledDate: getLocalISODate(new Date()),
    scheduledTime: '19:00',
    timezone: 'Asia/Shanghai',
    reminder: true,
    note: `${recipe.planNote}\n消耗库存：${recipe.usedItems.join('、') || '按实际食材确认'}。`,
    source: 'ai_advice',
  };
}
