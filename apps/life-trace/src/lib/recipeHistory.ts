import type { RecipeSuggestionItem, RecipeSuggestionResponse } from '@/api/advice';

const RECIPE_HISTORY_KEY = 'life-trace.recipe-history.v1';
const MAX_RECIPE_HISTORY_ITEMS = 30;

export type StoredRecipeSuggestion = RecipeSuggestionItem & {
  generatedAt: string;
  householdId?: string;
  householdName?: string;
  summary?: string;
};

function createRecipeHistoryId(baseId: string, index: number) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${index}`;
  return `${baseId || 'recipe'}-${suffix}`;
}

export function readRecipeHistory(): StoredRecipeSuggestion[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(RECIPE_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as StoredRecipeSuggestion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readRecipeHistoryItem(recipeId: string) {
  return readRecipeHistory().find((recipe) => recipe.id === recipeId) ?? null;
}

export function persistRecipeSuggestionResponse(
  response: RecipeSuggestionResponse,
): RecipeSuggestionResponse {
  if (typeof window === 'undefined' || response.recipes.length === 0) {
    return response;
  }

  const generatedAt = new Date().toISOString();
  const storedRecipes = response.recipes.map<StoredRecipeSuggestion>((recipe, index) => ({
    ...recipe,
    id: createRecipeHistoryId(recipe.id, index),
    generatedAt,
    householdId: response.householdId,
    householdName: response.householdName,
    summary: response.summary,
  }));
  const previous = readRecipeHistory().filter(
    (item) => !storedRecipes.some((recipe) => recipe.id === item.id),
  );
  const next = [...storedRecipes, ...previous].slice(0, MAX_RECIPE_HISTORY_ITEMS);
  window.localStorage.setItem(RECIPE_HISTORY_KEY, JSON.stringify(next));

  return {
    ...response,
    recipes: storedRecipes,
  };
}
