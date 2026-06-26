import { ArrowRight, Clock, Loader2, Plus, Sparkles, Utensils } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateRecipeSuggestions, type RecipeSuggestionRequest } from '@/api/advice';
import { SubPageShell } from '@/components/SubPageShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  persistRecipeSuggestionResponse,
  readRecipeHistory,
  type StoredRecipeSuggestion,
} from '@/lib/recipeHistory';
import { createPlanFromRecipe } from '@/lib/recipePlan';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { useFeedbackToastStore } from '@/store/useFeedbackToastStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

const mealOptions: RecipeSuggestionRequest['meal'][] = ['早餐', '午餐', '晚餐', '加餐'];
const servingOptions = [1, 2, 3, 4];
const timeOptions = [15, 30, 45, 60];

function formatRecipeDate(value?: string) {
  if (!value) {
    return '刚刚';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function RecipeCard({
  recipe,
  adding,
  onOpen,
  onAddPlan,
}: {
  recipe: StoredRecipeSuggestion;
  adding: boolean;
  onOpen: (recipe: StoredRecipeSuggestion) => void;
  onAddPlan: (recipe: StoredRecipeSuggestion) => void;
}) {
  return (
    <Card
      className="overflow-hidden border-life-health/15 bg-card/82 p-0 shadow-[0_18px_48px_rgba(71,58,42,0.07)]"
      data-scroll-anchor={`recipes:${recipe.id}`}
    >
      <button
        type="button"
        className="block w-full cursor-pointer p-4 text-left transition hover:bg-life-health/5"
        onClick={() => onOpen(recipe)}
      >
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
            <Utensils className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold">{recipe.title}</span>
                <span className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {recipe.reason}
                </span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
            </span>
            <span className="mt-3 flex flex-wrap gap-2">
              <Badge tone="health">{recipe.timeMinutes} 分钟</Badge>
              <Badge>{recipe.servings} 人份</Badge>
              <Badge>{recipe.difficulty}</Badge>
              {recipe.householdName ? <Badge>{recipe.householdName}</Badge> : null}
            </span>
          </span>
        </div>
      </button>
      <div className="flex items-center justify-between gap-3 border-t border-border/65 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          {formatRecipeDate(recipe.generatedAt)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={adding}
          onClick={() => onAddPlan(recipe)}
        >
          {adding ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          加入计划
        </Button>
      </div>
    </Card>
  );
}

export function AiRecipesPage() {
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const planCreating = useLifeTraceStore((state) => state.planCreating);
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const showToast = useFeedbackToastStore((state) => state.showToast);
  const [meal, setMeal] = useState<RecipeSuggestionRequest['meal']>('晚餐');
  const [servings, setServings] = useState(2);
  const [maxMinutes, setMaxMinutes] = useState(30);
  const [loading, setLoading] = useState(false);
  const [addingRecipeId, setAddingRecipeId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<StoredRecipeSuggestion[]>(() => readRecipeHistory());
  const latestRecipes = useMemo(() => history.slice(0, 3), [history]);
  const olderRecipes = useMemo(() => history.slice(3), [history]);
  const householdLabel = preferredPantryHouseholdId
    ? preferredPantryHouseholdName || '当前共享空间'
    : '我的空间';

  const openRecipe = (recipe: StoredRecipeSuggestion) => {
    navigate(`/ai/recipes/${recipe.id}`, { state: { recipe } });
  };

  const handleGenerate = async () => {
    if (!token) {
      setError('请先登录后再生成菜谱');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await generateRecipeSuggestions(token, {
        meal,
        servings,
        maxMinutes,
        householdId: preferredPantryHouseholdId || undefined,
      });
      const persisted = persistRecipeSuggestionResponse(response);
      setHistory(readRecipeHistory());
      showToast(`已生成 ${persisted.recipes.length} 份菜谱`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成菜谱失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPlan = async (recipe: StoredRecipeSuggestion) => {
    setAddingRecipeId(recipe.id);
    const plan = await addPlan(createPlanFromRecipe(recipe));
    setAddingRecipeId(null);
    if (plan) {
      showToast(`已加入「${plan.title}」`);
    } else {
      showToast('加入计划失败', 'error');
    }
  };

  return (
    <SubPageShell title="智能菜谱" eyebrow="Life AI" fallbackBackTo="/ai">
      <Card className="overflow-hidden border-life-health/20 bg-card/84 p-0 shadow-[0_18px_54px_rgba(71,58,42,0.08)]">
        <div className="border-b border-border/70 bg-life-health/6 p-4">
          <div className="flex items-start gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-health/12 text-life-health">
              <Sparkles className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">库存优先推荐</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                当前食材：{householdLabel}。生成后自动进入历史菜谱。
              </p>
            </div>
          </div>
        </div>
        <div className="space-y-4 p-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold">用餐</p>
            <div className="grid grid-cols-4 gap-2">
              {mealOptions.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={cn(
                    'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                    meal === item
                      ? 'border-life-health/45 bg-life-health/12 text-life-health'
                      : 'border-border bg-background/70 text-muted-foreground hover:bg-secondary',
                  )}
                  onClick={() => setMeal(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-sm font-semibold">人数</p>
              <div className="grid grid-cols-4 gap-1.5">
                {servingOptions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-sm font-semibold transition',
                      servings === item
                        ? 'border-life-health/45 bg-life-health/12 text-life-health'
                        : 'border-border bg-background/70 text-muted-foreground hover:bg-secondary',
                    )}
                    onClick={() => setServings(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">时长</p>
              <div className="grid grid-cols-4 gap-1.5">
                {timeOptions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={cn(
                      'rounded-xl border px-2 py-2 text-sm font-semibold transition',
                      maxMinutes === item
                        ? 'border-life-health/45 bg-life-health/12 text-life-health'
                        : 'border-border bg-background/70 text-muted-foreground hover:bg-secondary',
                    )}
                    onClick={() => setMaxMinutes(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {error ? (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/8 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          ) : null}
          <Button
            type="button"
            className="w-full"
            disabled={loading}
            onClick={() => void handleGenerate()}
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading ? '生成中' : '生成智能菜谱'}
          </Button>
        </div>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-semibold">历史菜谱</h2>
          <span className="text-xs font-semibold text-muted-foreground">{history.length} 份</span>
        </div>
        {history.length === 0 ? (
          <Card className="border-dashed bg-card/70 p-6 text-center">
            <p className="text-sm font-semibold">还没有历史菜谱</p>
            <p className="mt-2 text-sm text-muted-foreground">生成后会保存在这里。</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {latestRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                adding={addingRecipeId === recipe.id || planCreating}
                onOpen={openRecipe}
                onAddPlan={(item) => void handleAddPlan(item)}
              />
            ))}
            {olderRecipes.length > 0 ? (
              <div className="space-y-2 pt-1">
                <p className="px-1 text-sm font-semibold text-muted-foreground">更早</p>
                {olderRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    adding={addingRecipeId === recipe.id || planCreating}
                    onOpen={openRecipe}
                    onAddPlan={(item) => void handleAddPlan(item)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
    </SubPageShell>
  );
}
