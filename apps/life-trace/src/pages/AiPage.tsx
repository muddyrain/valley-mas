import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  Clock,
  History,
  Image,
  Lightbulb,
  ListChecks,
  Menu,
  MessageSquareText,
  Mic,
  MicOff,
  Plus,
  Search,
  Send,
  Shirt,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteWeeklyReview,
  generateRecipeSuggestions,
  generateTodayAdvice,
  generateWeeklyReview,
  listWeeklyReviews,
  type RecipeSuggestionItem,
  type RecipeSuggestionResponse,
  type WeeklyReviewResponse,
} from '@/api/advice';
import {
  clearLifeAssistantConversation,
  createLifeAssistantConversation,
  deleteLifeAssistantConversation,
  getLifeAssistantConversationById,
  type LifeAssistantActionEvent,
  type LifeAssistantConversation,
  type LifeAssistantMessage,
  listLifeAssistantConversations,
  saveLifeAssistantMessage,
  streamLifeAssistant,
} from '@/api/assistant';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AssistantMessageCard } from '@/components/AssistantMessageCard';
import { BottomSheet } from '@/components/BottomSheet';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { EmptyState } from '@/components/EmptyState';
import { LifeTraceBrandMark } from '@/components/LifeTraceBrandMark';
import { SectionHeader } from '@/components/SectionHeader';
import { SubPageShell } from '@/components/SubPageShell';
import { MessageSyncSkeleton, SyncState } from '@/components/SyncState';
import { TonePanel } from '@/components/TonePanel';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { suggestedPrompts } from '@/data/mock';
import { createPlanFromAdvice, hasAdvicePlan } from '@/lib/advicePlan';
import {
  filterAiActions,
  getAiActionMeta,
  getAssistantMessageDate,
  groupAssistantMessagesByDate,
} from '@/lib/aiHistory';
import { formatLedgerAmount } from '@/lib/ledger';
import { formatLocationDisplay } from '@/lib/location';
import {
  getPhotoItemAnalysisSummaryItems,
  PHOTO_ITEM_ANALYSIS_HISTORY_CHANGED_EVENT,
  type PhotoItemAnalysisHistoryItem,
  readPhotoItemAnalysisHistory,
} from '@/lib/photoItemAnalysis';
import {
  loadPhotoItemAnalysisHistory,
  removePhotoItemAnalysisHistoryItem,
} from '@/lib/photoItemAnalysisCloud';
import { getPlanDisplayTimeParts } from '@/lib/planReminder';
import { getLocalISODate } from '@/lib/planSchedule';
import { createPlanFromRecipe } from '@/lib/recipePlan';
import { readWeatherCache } from '@/lib/weatherCache';
import {
  buildWeeklyReviewActionMarker,
  createPlanFromWeeklyReviewAction,
  hasWeeklyReviewActionPlan,
} from '@/lib/weeklyReviewPlan';
import { findCurrentWeekReview, toggleExpandedWeeklyReviewId } from '@/lib/weeklyReviews';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { AdvicePayload, AiAction, NewPlanInput, Plan } from '@/types';

type AiResult = {
  title: string;
  detail: string;
  tone: 'ai' | 'plan' | 'trace' | 'health' | 'alert';
  weeklyReview?: WeeklyReviewDisplay;
};

type WeeklyReviewDisplay = Pick<
  WeeklyReviewResponse,
  'summary' | 'wins' | 'delays' | 'insights' | 'nextActions'
> &
  Partial<Pick<WeeklyReviewResponse, 'id' | 'weekStart' | 'weekEnd'>>;

type AssistantMessage = LifeAssistantMessage & {
  id: string;
  createdAt?: string;
};

type AssistantSpeechResult = {
  0: {
    transcript: string;
  };
  isFinal?: boolean;
  length: number;
};

type AssistantSpeechEvent = {
  resultIndex: number;
  results: ArrayLike<AssistantSpeechResult>;
};

type AssistantSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: AssistantSpeechEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type AssistantSpeechRecognitionCtor = new () => AssistantSpeechRecognition;

function formatPlanDisplayTime(
  plan: Pick<NewPlanInput, 'scheduledDate' | 'scheduledTime' | 'timeLabel'>,
) {
  const { dateText, timeText } = getPlanDisplayTimeParts(plan);
  return `${dateText} ${timeText}`;
}

function formatAssistantActionMessage(event: LifeAssistantActionEvent) {
  if (event.type === 'create_plan') {
    if (event.plan && event.status === 'created') {
      return `已经帮你加进计划了，${event.plan.title} 会在 ${formatPlanDisplayTime(event.plan)} 提醒。`;
    }
    if (event.plan && event.status === 'exists') {
      return `这个计划已经在列表里了：${event.plan.title}。`;
    }
    return event.message;
  }

  if (event.type === 'create_ledger_entry') {
    if (event.ledgerEntry && event.status === 'created') {
      return `已经帮你记下这笔账：${formatLedgerAmount(event.ledgerEntry.amountCents, event.ledgerEntry.currency)} · ${event.ledgerEntry.category}。`;
    }
    return event.message;
  }

  return event.message;
}

function formatPhotoItemHistoryTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '刚刚';
  }
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPhotoItemQualityFeedback(item: PhotoItemAnalysisHistoryItem) {
  if (!item.qualityFeedback) {
    return null;
  }
  return item.qualityFeedback.rating === 'accurate'
    ? { label: '准确', tone: 'trace' as const }
    : { label: '不准确', tone: 'alert' as const };
}

function PhotoItemHistoryRow({
  item,
  onOpenPhotoItemDraft,
  onOpenSavedPantryItem,
  onRemovePhotoItemDraft,
}: {
  item: PhotoItemAnalysisHistoryItem;
  onOpenPhotoItemDraft: (draftId: string) => void;
  onOpenSavedPantryItem: () => void;
  onRemovePhotoItemDraft?: (draftId: string) => void;
}) {
  const qualityFeedback = formatPhotoItemQualityFeedback(item);
  const saved = item.status === 'saved';
  const itemName = item.form.name || item.analysis.name || '待确认商品';

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-secondary/45 p-2 text-left transition hover:bg-secondary">
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-life-ai/40"
        onClick={() => (saved ? onOpenSavedPantryItem() : onOpenPhotoItemDraft(item.id))}
      >
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={itemName}
            className="size-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-background text-life-ai">
            <Image className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{itemName}</span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">
            {formatPhotoItemHistoryTime(item.updatedAt)} · {item.householdName || '我的空间'}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={saved ? 'trace' : 'ai'}>{saved ? '已入库' : '草稿'}</Badge>
          {qualityFeedback ? (
            <Badge tone={qualityFeedback.tone}>{qualityFeedback.label}</Badge>
          ) : null}
        </span>
      </button>
      {!saved && onRemovePhotoItemDraft ? (
        <button
          type="button"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-life-alert/15 bg-background/70 text-life-alert transition hover:border-life-alert/35 hover:bg-life-alert/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-life-alert/30"
          aria-label={`移除${itemName}草稿`}
          onClick={() => onRemovePhotoItemDraft(item.id)}
        >
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

function normalizeAssistantMessage(message: LifeAssistantMessage, index: number): AssistantMessage {
  return {
    id: message.id || `${message.role}-${message.createdAt || Date.now()}-${index}`,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function formatAssistantMessageTime(message: AssistantMessage) {
  const date = getAssistantMessageDate(message);
  if (!date) {
    return '';
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConversationTime(conversation: LifeAssistantConversation) {
  const value = conversation.updatedAt || conversation.createdAt;
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function WeeklyReviewPanel({
  review,
  addingActionKey,
  isNextActionAdded,
  onAddNextAction,
}: {
  review: WeeklyReviewDisplay;
  addingActionKey?: string | null;
  isNextActionAdded?: (actionIndex: number) => boolean;
  onAddNextAction?: (action: string, actionIndex: number) => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted-foreground">{review.summary}</p>
      <div className="grid gap-3">
        {[
          {
            title: '完成事项',
            items: review.wins,
            icon: Check,
            className: 'border-life-trace/25 bg-life-trace/10 text-life-trace',
          },
          {
            title: '延迟事项',
            items: review.delays,
            icon: AlertCircle,
            className: 'border-life-alert/25 bg-life-alert/10 text-life-alert',
          },
          {
            title: '生活洞察',
            items: review.insights,
            icon: Lightbulb,
            className: 'border-life-ai/25 bg-life-ai/10 text-life-ai',
          },
          {
            title: '下周行动',
            items: review.nextActions,
            icon: ArrowRight,
            className: 'border-life-plan/25 bg-life-plan/10 text-life-plan',
          },
        ].map((section) => {
          const Icon = section.icon;

          return (
            <div key={section.title} className={`rounded-2xl border p-4 ${section.className}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="size-4" />
                {section.title}
              </div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                {section.items.map((item, itemIndex) => {
                  const canCreatePlan =
                    section.title === '下周行动' && Boolean(review.id && onAddNextAction);
                  const added = canCreatePlan ? isNextActionAdded?.(itemIndex) === true : false;
                  const actionKey =
                    canCreatePlan && review.id
                      ? buildWeeklyReviewActionMarker(review.id, itemIndex)
                      : '';
                  const adding = addingActionKey === actionKey;

                  return (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-70" />
                      <span className="min-w-0 flex-1">{item}</span>
                      {canCreatePlan ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-life-plan/10 hover:text-life-plan disabled:cursor-default disabled:opacity-80"
                          disabled={added || Boolean(addingActionKey)}
                          onClick={() => onAddNextAction?.(item, itemIndex)}
                        >
                          {adding ? (
                            <ActionLoadingIcon className="size-3.5" />
                          ) : added ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          {adding ? '加入中' : added ? '已加入' : '加入计划'}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecipeSuggestionPanel({
  result,
  addingRecipeId,
  onAddRecipePlan,
}: {
  result: RecipeSuggestionResponse;
  addingRecipeId: string | null;
  onAddRecipePlan: (recipe: RecipeSuggestionItem) => void;
}) {
  return (
    <div className="mb-3 space-y-3">
      <div className="rounded-2xl border border-life-health/25 bg-life-health/10 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Utensils className="size-4 text-life-health" />
          <Badge tone="health">库存优先</Badge>
          <p className="min-w-0 flex-1 text-sm font-semibold">
            {result.householdName ? `${result.householdName} · ` : ''}
            {result.summary}
          </p>
        </div>
        {result.warnings.length > 0 ? (
          <div className="mt-3 space-y-1.5">
            {result.warnings.map((warning) => (
              <p key={warning} className="text-xs leading-5 text-muted-foreground">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      {result.recipes.length > 0 ? (
        <div className="space-y-3">
          {result.recipes.map((recipe) => {
            const adding = addingRecipeId === recipe.id;

            return (
              <Card key={recipe.id} className="border-life-health/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="health">{recipe.timeMinutes} 分钟</Badge>
                      <Badge tone="ai">{recipe.difficulty}</Badge>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {recipe.servings} 人份
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold leading-snug">{recipe.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{recipe.reason}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-life-plan px-3 py-1.5 text-xs font-semibold text-background transition hover:bg-life-plan/90 disabled:cursor-default disabled:opacity-70"
                    disabled={Boolean(addingRecipeId)}
                    onClick={() => onAddRecipePlan(recipe)}
                  >
                    {adding ? (
                      <ActionLoadingIcon className="size-3.5 text-background" />
                    ) : (
                      <Plus className="size-3.5" />
                    )}
                    {adding ? '加入中' : '加入计划'}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 text-xs leading-5 text-muted-foreground">
                  <p>
                    <span className="font-semibold text-foreground">消耗：</span>
                    {recipe.usedItems.length > 0 ? recipe.usedItems.join('、') : '按现有食材确认'}
                  </p>
                  {recipe.missingItems.length > 0 ? (
                    <p>
                      <span className="font-semibold text-foreground">可能缺：</span>
                      {recipe.missingItems.join('、')}
                    </p>
                  ) : null}
                </div>

                <ol className="mt-3 space-y-2 text-sm leading-6">
                  {recipe.steps.map((step, stepIndex) => (
                    <li key={`${recipe.id}-${step}`} className="flex gap-2">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-life-health">
                        {stepIndex + 1}
                      </span>
                      <span className="min-w-0">{step}</span>
                    </li>
                  ))}
                </ol>

                {recipe.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {recipe.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="暂时没有可用食材"
          description="去 Pantry 补充食品或切换家庭空间后，再让 Life AI 生成菜谱。"
          eyebrow="智能菜谱"
          icon={Utensils}
          tone="health"
          align="center"
        />
      )}
    </div>
  );
}

function RecipeLoadingState() {
  return (
    <div className="mb-3 rounded-2xl border border-life-health/25 bg-life-health/10 p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
          <ActionLoadingIcon className="size-5" tone="health" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">正在生成智能菜谱</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            正在读取当前 Pantry 食品库存。
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2" aria-hidden="true">
        <div className="h-3 w-3/4 animate-pulse rounded-full bg-life-health/20 motion-reduce:animate-none" />
        <div className="h-3 w-1/2 animate-pulse rounded-full bg-life-health/20 motion-reduce:animate-none" />
      </div>
    </div>
  );
}

function WeeklyReviewsArchive({
  reviews,
  loading,
  deletingId,
  expandedId,
  onBack,
  onToggleExpanded,
  onRequestDelete,
  onAddNextAction,
  getNextActionAdded,
  addingActionKey,
}: {
  reviews: WeeklyReviewResponse[];
  loading: boolean;
  deletingId: string | null;
  expandedId: string | null;
  onBack: () => void;
  onToggleExpanded: (review: WeeklyReviewResponse) => void;
  onRequestDelete: (review: WeeklyReviewResponse) => void;
  onAddNextAction: (review: WeeklyReviewResponse, action: string, actionIndex: number) => void;
  getNextActionAdded: (review: WeeklyReviewResponse, actionIndex: number) => boolean;
  addingActionKey: string | null;
}) {
  return (
    <SubPageShell title="历史周报" eyebrow="周报归档" onBack={onBack} contentClassName="space-y-6">
      {loading ? (
        <SyncState
          title="正在同步历史周报"
          description="正在读取已存档的每周回顾。"
          tone="health"
        />
      ) : null}

      {!loading && reviews.length === 0 ? (
        <EmptyState
          title="还没有历史周报"
          description="生成“服务端 AI 每周回顾”后，会自动保存到这里。"
          eyebrow="周报归档"
          icon={ListChecks}
          tone="health"
        />
      ) : null}

      <div className="space-y-3">
        {reviews.map((review) => {
          const expanded = expandedId === review.id;
          const archivedTime = review.updatedAt || review.createdAt;

          return (
            <Card key={review.id} className="border-life-health/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  aria-expanded={expanded}
                  onClick={() => onToggleExpanded(review)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="health">
                      {review.weekStart} - {review.weekEnd}
                    </Badge>
                    {archivedTime ? (
                      <span className="text-xs text-muted-foreground">
                        更新于 {formatWeeklyReviewDateTime(archivedTime)}
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 line-clamp-2 text-base font-semibold leading-snug">
                    {review.summary}
                  </h2>
                  <p className="mt-2 text-xs font-semibold text-life-health">
                    {expanded ? '收起完整周报' : '查看完整周报'}
                  </p>
                </button>
                <button
                  type="button"
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-muted-foreground transition hover:bg-life-alert/10 hover:text-life-alert disabled:cursor-default disabled:opacity-70"
                  aria-label={`删除 ${review.weekStart} 至 ${review.weekEnd} 周报`}
                  disabled={Boolean(deletingId)}
                  onClick={() => onRequestDelete(review)}
                >
                  {deletingId === review.id ? (
                    <ActionLoadingIcon tone="alert" className="size-4" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
              {expanded ? (
                <div className="mt-4 border-t border-border pt-4">
                  <WeeklyReviewPanel
                    review={review}
                    addingActionKey={addingActionKey}
                    isNextActionAdded={(actionIndex) => getNextActionAdded(review, actionIndex)}
                    onAddNextAction={(action, actionIndex) =>
                      onAddNextAction(review, action, actionIndex)
                    }
                  />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </SubPageShell>
  );
}

function AssistantHistoryPage({
  messages,
  loading,
  streaming,
  onBack,
  onRequestClear,
  notice,
}: {
  messages: AssistantMessage[];
  loading: boolean;
  streaming: boolean;
  onBack: () => void;
  onRequestClear: () => void;
  notice?: string;
}) {
  const [keyword, setKeyword] = useState('');
  const groups = groupAssistantMessagesByDate(messages, keyword);
  const filteredMessageCount = groups.reduce((sum, group) => sum + group.messages.length, 0);
  const hasKeyword = keyword.trim().length > 0;

  return (
    <SubPageShell
      title="对话历史"
      eyebrow="Life AI"
      onBack={onBack}
      contentClassName="space-y-6"
      action={
        <button
          type="button"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-life-alert/10 hover:text-life-alert disabled:cursor-default disabled:opacity-50"
          aria-label="清空对话历史"
          disabled={loading || messages.length === 0}
          onClick={onRequestClear}
        >
          <Trash2 className="size-4" />
        </button>
      }
    >
      {notice ? (
        <TonePanel tone="trace" className="p-4">
          <p className="text-sm font-semibold text-life-trace">{notice}</p>
        </TonePanel>
      ) : null}

      <section className="space-y-4">
        <div className="space-y-3">
          <SectionHeader
            title="全部对话"
            meta={loading ? '同步中' : `${filteredMessageCount} 条`}
          />
          <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-sm text-muted-foreground focus-within:border-life-ai/50 focus-within:text-life-ai">
            <Search className="size-4 shrink-0" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              className="min-w-0 flex-1 bg-transparent py-2.5 text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="搜索对话内容"
            />
          </label>
        </div>
        {loading && messages.length === 0 ? (
          <MessageSyncSkeleton />
        ) : groups.length > 0 ? (
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.label} className="space-y-3">
                <div className="sticky top-0 z-10 -mx-1 bg-background/80 px-1 py-1 backdrop-blur">
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                {group.messages.map((message) => (
                  <AssistantMessageCard
                    key={message.id}
                    message={message}
                    meta={formatAssistantMessageTime(message)}
                    streaming={streaming && message.id === messages[messages.length - 1]?.id}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : hasKeyword ? (
          <EmptyState
            title="没有匹配对话"
            description="换个关键词再找找。"
            eyebrow="对话搜索"
            icon={Search}
            tone="ai"
            align="center"
          />
        ) : (
          <EmptyState
            title="还没有对话"
            description="回到 Life AI，说一句“帮我安排今天晚上”，生活助理会把对话记录同步到这里。"
            eyebrow="生活助理"
            icon={History}
            tone="ai"
            align="center"
          />
        )}
      </section>
    </SubPageShell>
  );
}

function AiActionCard({ action }: { action: AiAction }) {
  const meta = getAiActionMeta(action);
  const Icon =
    meta.label === '计划'
      ? CalendarDays
      : meta.label === '图片'
        ? Image
        : meta.label === 'Pantry'
          ? Utensils
          : meta.label === '回顾'
            ? History
            : Sparkles;

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-life-ai">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {action.timeLabel}
          </div>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold leading-5">{action.title}</h3>
      </div>
    </Card>
  );
}

function AiActionsArchive({ actions, onBack }: { actions: AiAction[]; onBack: () => void }) {
  const [keyword, setKeyword] = useState('');
  const filteredActions = filterAiActions(actions, keyword);
  const hasKeyword = keyword.trim().length > 0;

  return (
    <SubPageShell
      title="AI 操作历史"
      eyebrow="Life AI"
      onBack={onBack}
      contentClassName="space-y-6"
    >
      <section className="space-y-3">
        <SectionHeader title="动作追踪" meta={`${filteredActions.length} 条`} />
        <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-border bg-card px-3 text-sm text-muted-foreground focus-within:border-life-ai/50 focus-within:text-life-ai">
          <Search className="size-4 shrink-0" />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            className="min-w-0 flex-1 bg-transparent py-2.5 text-foreground outline-none placeholder:text-muted-foreground"
            placeholder="搜索动作"
          />
        </label>
      </section>

      {filteredActions.length > 0 ? (
        <div className="space-y-3">
          {filteredActions.map((action) => (
            <AiActionCard key={action.id} action={action} />
          ))}
        </div>
      ) : hasKeyword ? (
        <EmptyState
          title="没有匹配动作"
          description="换个关键词再找找。"
          eyebrow="动作搜索"
          icon={Search}
          tone="ai"
          align="center"
        />
      ) : (
        <EmptyState
          title="还没有 AI 操作"
          description="生成建议、创建计划、处理库存后，最近操作会保存在这里。"
          eyebrow="Life AI"
          icon={Sparkles}
          tone="ai"
          align="center"
        />
      )}
    </SubPageShell>
  );
}

function PhotoItemHistoryArchive({
  items,
  onBack,
  onOpenPhotoAnalysis,
  onOpenPhotoItemDraft,
  onOpenSavedPantryItem,
  onRemovePhotoItemDraft,
}: {
  items: PhotoItemAnalysisHistoryItem[];
  onBack: () => void;
  onOpenPhotoAnalysis: () => void;
  onOpenPhotoItemDraft: (draftId: string) => void;
  onOpenSavedPantryItem: () => void;
  onRemovePhotoItemDraft: (draftId: string) => void;
}) {
  const draftCount = items.filter((item) => item.status === 'draft').length;

  return (
    <SubPageShell
      title="最近商品识别"
      eyebrow="Life AI"
      onBack={onBack}
      contentClassName="space-y-6"
      action={
        <button
          type="button"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-life-ai/25 bg-life-ai/10 text-life-ai transition hover:bg-life-ai/15"
          aria-label="拍照识别商品"
          onClick={onOpenPhotoAnalysis}
        >
          <Camera className="size-4" />
        </button>
      }
    >
      <section>
        <SectionHeader
          title="全部记录"
          meta={draftCount > 0 ? `${draftCount} 条草稿` : `${items.length} 条`}
        />
        {items.length > 0 ? (
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <PhotoItemHistoryRow
                key={item.id}
                item={item}
                onOpenPhotoItemDraft={onOpenPhotoItemDraft}
                onOpenSavedPantryItem={onOpenSavedPantryItem}
                onRemovePhotoItemDraft={onRemovePhotoItemDraft}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="还没有商品识别"
            description="拍照或从相册选择商品后，识别记录会保存。"
            eyebrow="商品识别"
            icon={Camera}
            tone="ai"
            align="center"
          />
        )}
      </section>
    </SubPageShell>
  );
}

function AssistantConversationSheet({
  open,
  conversations,
  activeConversationId,
  loading,
  creating,
  deletingId,
  onOpenChange,
  onCreate,
  onSelect,
  onDelete,
}: {
  open: boolean;
  conversations: LifeAssistantConversation[];
  activeConversationId: string;
  loading: boolean;
  creating: boolean;
  deletingId: string | null;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  onSelect: (conversation: LifeAssistantConversation) => void;
  onDelete: (conversation: LifeAssistantConversation) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭话题列表"
      className="space-y-4"
      portal
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">聊天话题</p>
          <p className="mt-1 text-sm text-muted-foreground">
            切换不同主题，避免所有内容挤在一条对话里。
          </p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-life-ai px-4 py-2 text-sm font-semibold text-background transition hover:bg-life-ai/90 disabled:opacity-70"
          disabled={creating}
          onClick={onCreate}
        >
          {creating ? (
            <ActionLoadingIcon className="size-4 text-background" />
          ) : (
            <Plus className="size-4" />
          )}
          新话题
        </button>
      </div>

      <div className="max-h-[58dvh] space-y-2 overflow-y-auto pr-1">
        {loading && conversations.length === 0 ? (
          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            正在同步话题...
          </div>
        ) : conversations.length > 0 ? (
          conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            const deleting = deletingId === conversation.id;

            return (
              <div
                key={conversation.id}
                className={`flex items-center gap-2 rounded-2xl border p-2 ${
                  active ? 'border-life-ai/35 bg-life-ai/10' : 'border-border bg-card'
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-secondary/60"
                  onClick={() => onSelect(conversation)}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                    {active ? (
                      <Check className="size-4 text-life-ai" />
                    ) : (
                      <MessageSquareText className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">
                      {conversation.title || '新话题'}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatConversationTime(conversation) || '刚刚'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-life-alert/10 hover:text-life-alert disabled:opacity-50"
                  aria-label={`删除${conversation.title || '话题'}`}
                  disabled={deleting || conversations.length <= 1}
                  onClick={() => onDelete(conversation)}
                >
                  {deleting ? (
                    <ActionLoadingIcon className="size-4" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
            还没有话题，点“新话题”开始。
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

function ContextSummaryChip({
  icon: Icon,
  label,
  value,
  toneClass,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  toneClass: string;
}) {
  return (
    <div className="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-full border border-border bg-secondary/45 px-3 py-2 text-xs">
      <Icon className={`size-3.5 shrink-0 ${toneClass}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </div>
  );
}

function AssistantLandingPromptButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Sparkles;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="inline-flex min-h-12 w-full items-center gap-3 rounded-2xl border border-border/80 bg-secondary/35 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-secondary"
      onClick={onClick}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-background/80 text-life-ai">
        <Icon className="size-4" />
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 leading-5">{title}</span>
    </button>
  );
}

function AssistantToolRow({
  icon: Icon,
  label,
  toneClass,
  onClick,
  loading = false,
  disabled = false,
  meta,
}: {
  icon: typeof Sparkles;
  label: string;
  toneClass: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  meta?: string;
}) {
  return (
    <button
      type="button"
      className="flex min-h-12 w-full items-center gap-3 rounded-2xl border border-white/[0.06] bg-card/70 px-3 py-2.5 text-left transition hover:border-border hover:bg-secondary/70 disabled:opacity-70"
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl bg-secondary/70 ${toneClass}`}
      >
        {loading ? <ActionLoadingIcon className="size-4" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{label}</span>
      {meta ? (
        <span className="shrink-0 rounded-full border border-border bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {meta}
        </span>
      ) : null}
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}

function AssistantToolsSheet({
  open,
  quickActionLoading,
  weeklyReviewsLoading,
  weeklyReviewCount,
  aiActionCount,
  latestPhotoDraft,
  onOpenChange,
  onOpenWeeklyReviews,
  onOpenHistory,
  onOpenActions,
  onOpenPhotoAnalysis,
  onOpenPhotoItemDraft,
  onQuickAction,
}: {
  open: boolean;
  quickActionLoading: string | null;
  weeklyReviewsLoading: boolean;
  weeklyReviewCount: number;
  aiActionCount: number;
  latestPhotoDraft: PhotoItemAnalysisHistoryItem | null;
  onOpenChange: (open: boolean) => void;
  onOpenWeeklyReviews: () => void;
  onOpenHistory: () => void;
  onOpenActions: () => void;
  onOpenPhotoAnalysis: () => void;
  onOpenPhotoItemDraft: (draftId: string) => void;
  onQuickAction: (label: string) => void;
}) {
  const closeAndRun = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      overlayLabel="关闭 AI 工具"
      contentClassName="space-y-6"
      portal
    >
      <div className="px-1 pb-1">
        <p className="text-2xl font-semibold tracking-normal">AI 工具</p>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">计划、Pantry 与回顾</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-sm font-semibold">生活动作</p>
          <span className="text-xs text-muted-foreground">5 个动作</span>
        </div>
        <div className="space-y-2 rounded-[1.35rem] border border-border/80 bg-secondary/15 p-2.5">
          <AssistantToolRow
            icon={Sun}
            label="今天安排"
            toneClass="text-life-health"
            loading={quickActionLoading === '生成今日建议'}
            disabled={Boolean(quickActionLoading)}
            onClick={() => closeAndRun(() => onQuickAction('生成今日建议'))}
          />
          <AssistantToolRow
            icon={CalendarDays}
            label="创建计划"
            toneClass="text-life-plan"
            disabled={Boolean(quickActionLoading)}
            onClick={() => closeAndRun(() => onQuickAction('创建计划'))}
          />
          <AssistantToolRow
            icon={Sparkles}
            label="生成踪迹"
            toneClass="text-life-ai"
            disabled={Boolean(quickActionLoading)}
            onClick={() => closeAndRun(() => onQuickAction('生成踪迹'))}
          />
          <AssistantToolRow
            icon={Shirt}
            label="今日穿搭"
            toneClass="text-life-trace"
            disabled={Boolean(quickActionLoading)}
            onClick={() => closeAndRun(() => onQuickAction('今日穿搭'))}
          />
          <AssistantToolRow
            icon={Camera}
            label="拍照识别衣物"
            toneClass="text-life-ai"
            disabled={Boolean(quickActionLoading)}
            onClick={() => closeAndRun(() => onQuickAction('拍照识别衣物'))}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 px-1">
          <p className="text-sm font-semibold">Pantry 智能</p>
          <span className="text-xs text-muted-foreground">5 个入口</span>
        </div>
        <div className="space-y-2 rounded-[1.35rem] border border-border/80 bg-secondary/15 p-2.5">
          <AssistantToolRow
            icon={Camera}
            label="拍照分析商品"
            toneClass="text-life-ai"
            onClick={() => closeAndRun(onOpenPhotoAnalysis)}
          />
          <AssistantToolRow
            icon={Utensils}
            label="智能菜谱"
            toneClass="text-life-health"
            loading={quickActionLoading === '智能菜谱'}
            disabled={Boolean(quickActionLoading)}
            onClick={() => closeAndRun(() => onQuickAction('智能菜谱'))}
          />
          <AssistantToolRow
            icon={History}
            label="历史周报"
            toneClass="text-life-health"
            meta={weeklyReviewsLoading ? '同步中' : String(weeklyReviewCount)}
            onClick={() => closeAndRun(onOpenWeeklyReviews)}
          />
          <AssistantToolRow
            icon={MessageSquareText}
            label="对话历史"
            toneClass="text-life-ai"
            onClick={() => closeAndRun(onOpenHistory)}
          />
          <AssistantToolRow
            icon={Sparkles}
            label="AI 操作"
            toneClass="text-life-ai"
            meta={String(aiActionCount)}
            onClick={() => closeAndRun(onOpenActions)}
          />
        </div>
        {latestPhotoDraft ? (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-life-ai/20 bg-card px-3 py-3 text-left transition hover:bg-secondary"
            onClick={() => closeAndRun(() => onOpenPhotoItemDraft(latestPhotoDraft.id))}
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {latestPhotoDraft.form.name || latestPhotoDraft.analysis.name}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {formatPhotoItemHistoryTime(latestPhotoDraft.updatedAt)} · 待继续确认
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-life-ai/10 px-3 py-1.5 text-xs font-semibold text-life-ai">
              <ArrowRight className="size-3.5" />
              继续
            </span>
          </button>
        ) : null}
      </div>
    </BottomSheet>
  );
}

function AgentConversationPanel({
  conversation,
  messages,
  loading,
  streaming,
  model,
  input,
  result,
  recipeResult,
  adviceCards,
  plans,
  addingAdviceId,
  addingRecipeId,
  weeklyReviews,
  weeklyReviewsLoading,
  photoItemHistory,
  quickActionLoading,
  aiActions,
  locationLabel,
  weatherSummary,
  pantryHouseholdLabel,
  openPlanCount,
  completedCheckinCount,
  expiringPantryCount,
  speechSupported,
  listening,
  speechError,
  onInputChange,
  onSubmit,
  onPrompt,
  onToggleListening,
  onOpenConversations,
  onCreateConversation,
  onOpenWeeklyReviews,
  onOpenHistory,
  onOpenPhotoAnalysis,
  onOpenPhotoItemHistory,
  onOpenPhotoItemDraft,
  onOpenSavedPantryItem,
  onRemovePhotoItemDraft,
  onOpenActions,
  toolsSheetOpen,
  onToolsSheetOpenChange,
  onAddAdvicePlan,
  onAddRecipePlan,
  onQuickAction,
}: {
  conversation: LifeAssistantConversation | null;
  messages: AssistantMessage[];
  loading: boolean;
  streaming: boolean;
  model: string;
  input: string;
  result: AiResult | null;
  recipeResult: RecipeSuggestionResponse | null;
  adviceCards: AdvicePayload[];
  plans: Plan[];
  addingAdviceId: string | null;
  addingRecipeId: string | null;
  weeklyReviews: WeeklyReviewResponse[];
  weeklyReviewsLoading: boolean;
  photoItemHistory: PhotoItemAnalysisHistoryItem[];
  quickActionLoading: string | null;
  aiActions: AiAction[];
  locationLabel: string;
  weatherSummary: string;
  pantryHouseholdLabel: string;
  openPlanCount: number;
  completedCheckinCount: number;
  expiringPantryCount: number;
  speechSupported: boolean;
  listening: boolean;
  speechError: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onPrompt: (prompt: (typeof suggestedPrompts)[number]) => void;
  onToggleListening: () => void;
  onOpenConversations: () => void;
  onCreateConversation: () => void;
  onOpenWeeklyReviews: () => void;
  onOpenHistory: () => void;
  onOpenPhotoAnalysis: () => void;
  onOpenPhotoItemHistory: () => void;
  onOpenPhotoItemDraft: (draftId: string) => void;
  onOpenSavedPantryItem: () => void;
  onRemovePhotoItemDraft: (draftId: string) => void;
  onOpenActions: () => void;
  toolsSheetOpen: boolean;
  onToolsSheetOpenChange: (open: boolean) => void;
  onAddAdvicePlan: (item: AdvicePayload) => void;
  onAddRecipePlan: (recipe: RecipeSuggestionItem) => void;
  onQuickAction: (label: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const latestMessage = messages[messages.length - 1];
  const canSend = Boolean(input.trim()) && !streaming;
  const latestPhotoDraft = photoItemHistory.find((item) => item.status === 'draft') ?? null;
  const summaryPhotoItemHistory = getPhotoItemAnalysisSummaryItems(photoItemHistory);
  const hasChatActivity =
    messages.length > 0 || Boolean(result) || Boolean(recipeResult) || adviceCards.length > 0;
  const landingPromptCards = suggestedPrompts.slice(0, 4);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });

  return (
    <div className="flex h-[calc(100dvh_-_8.75rem_-_env(safe-area-inset-bottom))] min-h-0 flex-col overflow-hidden bg-background max-[360px]:h-[calc(100dvh_-_8.35rem_-_env(safe-area-inset-bottom))]">
      <div className="grid shrink-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full text-foreground transition hover:bg-secondary"
          aria-label="打开话题列表"
          onClick={onOpenConversations}
        >
          <Menu className="size-6" />
        </button>
        <div className="min-w-0 text-center">
          <div className="flex min-w-0 items-center justify-center gap-1">
            <p className="truncate text-base font-semibold">
              {conversation?.title || 'Life Trace Agent'}
            </p>
            {streaming ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-life-ai/10 px-2 py-0.5 text-xs font-semibold text-life-ai">
                <ActionLoadingIcon className="size-3" />
                思考中
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {streaming
              ? '正在流式输出'
              : loading
                ? '正在同步云端对话'
                : model
                  ? `模型 ${model}`
                  : '内容由 AI 生成'}
          </p>
        </div>
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full text-foreground transition hover:bg-secondary disabled:opacity-50"
          aria-label="新话题"
          disabled={streaming}
          onClick={onCreateConversation}
        >
          <Plus className="size-6" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {!hasChatActivity ? (
              <div className="mb-5 space-y-4 py-6">
                <div className="rounded-[1.4rem] border border-life-ai/20 bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-lg font-semibold">今天想怎么过？</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {locationLabel} · {weatherSummary}
                      </p>
                    </div>
                    <LifeTraceBrandMark className="size-10 rounded-2xl" />
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <ContextSummaryChip
                      icon={CalendarDays}
                      label="计划"
                      value={`${openPlanCount} 项`}
                      toneClass="text-life-plan"
                    />
                    <ContextSummaryChip
                      icon={Utensils}
                      label="临期"
                      value={`${expiringPantryCount} 件`}
                      toneClass="text-life-health"
                    />
                    <ContextSummaryChip
                      icon={Check}
                      label="打卡"
                      value={`${completedCheckinCount} 项`}
                      toneClass="text-life-trace"
                    />
                    <ContextSummaryChip
                      icon={Sparkles}
                      label="Pantry"
                      value={pantryHouseholdLabel}
                      toneClass="text-life-ai"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <p className="text-sm font-semibold text-muted-foreground">开场提问</p>
                    {streaming ? <Badge tone="ai">思考中</Badge> : null}
                  </div>
                  <div className="grid gap-2">
                    {landingPromptCards.map((prompt) => {
                      const Icon = prompt.icon;

                      return (
                        <AssistantLandingPromptButton
                          key={prompt.title}
                          icon={Icon}
                          title={prompt.title}
                          onClick={() => onPrompt(prompt)}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {result ? (
              <div className="mb-3 rounded-2xl border border-life-ai/20 bg-life-ai/5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles className="size-4 text-life-ai" />
                  <Badge tone={result.tone}>Agent 结果</Badge>
                  <h2 className="min-w-0 flex-1 text-sm font-semibold">{result.title}</h2>
                </div>
                {result.weeklyReview ? (
                  <div className="mt-3">
                    <WeeklyReviewPanel review={result.weeklyReview} />
                  </div>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.detail}</p>
                )}
              </div>
            ) : null}

            {adviceCards.length > 0 ? (
              <div className="mb-3 grid gap-2">
                {adviceCards.map((item) => {
                  const added = hasAdvicePlan(plans, item.id);
                  const adding = addingAdviceId === item.id;

                  return (
                    <div key={item.id} className="rounded-2xl border border-border bg-card p-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge tone={item.tone}>{item.title}</Badge>
                        <button
                          type="button"
                          disabled={added || Boolean(addingAdviceId)}
                          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-foreground transition hover:bg-accent disabled:cursor-default disabled:text-life-trace disabled:opacity-100"
                          aria-label={added ? '已加入计划' : `添加${item.title}计划`}
                          onClick={() => onAddAdvicePlan(item)}
                        >
                          {adding ? (
                            <ActionLoadingIcon className="size-4" />
                          ) : added ? (
                            <Check className="size-4" />
                          ) : (
                            <Plus className="size-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!hasChatActivity && summaryPhotoItemHistory.length > 0 ? (
              <div className="mb-3 rounded-2xl border border-life-ai/20 bg-card p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">最近商品识别</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      草稿可继续编辑，已入库商品可回到库存查看。
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center rounded-full border border-life-ai/20 px-3 py-1.5 text-xs font-semibold text-life-ai transition hover:bg-life-ai/10"
                      onClick={onOpenPhotoItemHistory}
                    >
                      全部
                    </button>
                    <button
                      type="button"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-life-ai/10 px-3 py-1.5 text-xs font-semibold text-life-ai"
                      onClick={onOpenPhotoAnalysis}
                    >
                      <Camera className="size-3.5" />
                      继续拍
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {summaryPhotoItemHistory.map((item) => (
                    <PhotoItemHistoryRow
                      key={item.id}
                      item={item}
                      onOpenPhotoItemDraft={onOpenPhotoItemDraft}
                      onOpenSavedPantryItem={onOpenSavedPantryItem}
                      onRemovePhotoItemDraft={onRemovePhotoItemDraft}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {recipeResult ? (
              <RecipeSuggestionPanel
                result={recipeResult}
                addingRecipeId={addingRecipeId}
                onAddRecipePlan={onAddRecipePlan}
              />
            ) : null}
            {quickActionLoading === '智能菜谱' && !recipeResult ? <RecipeLoadingState /> : null}

            {messages.length > 0 ? (
              <div className="space-y-2.5">
                {messages.map((message) => (
                  <AssistantMessageCard
                    key={message.id}
                    message={message}
                    meta={formatAssistantMessageTime(message)}
                    streaming={streaming && message.id === latestMessage?.id}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border bg-background/88 p-2 backdrop-blur">
            <div className="rounded-[1.1rem] border border-life-ai/25 bg-secondary/40 p-2 transition focus-within:border-life-ai/60 focus-within:bg-secondary focus-within:shadow-[0_0_0_3px_rgba(6,182,212,0.08)]">
              <Textarea
                className="max-h-28 min-h-12 border-0 bg-transparent px-3 py-1.5 text-base leading-7 focus:border-transparent focus-visible:border-transparent focus-visible:ring-0"
                value={input}
                disabled={streaming}
                placeholder="输入想聊的事"
                onChange={(event) => onInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    onSubmit();
                  }
                }}
              />
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">
                    {listening
                      ? '正在听写，停下后可以直接发送'
                      : streaming
                        ? '生活助理正在流式输出'
                        : '所有工具都会在当前 chat 内完成'}
                  </p>
                  {speechError ? (
                    <p className="mt-1 text-xs text-life-alert">{speechError}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-life-ai/20 bg-card px-3 text-sm font-semibold text-life-ai transition hover:bg-life-ai/5"
                    aria-label="打开 AI 工具"
                    onClick={() => onToolsSheetOpenChange(true)}
                  >
                    <Sparkles className="size-4" />
                    工具
                  </button>
                  <button
                    type="button"
                    className={`grid size-10 place-items-center rounded-2xl border transition ${
                      listening
                        ? 'border-life-ai bg-life-ai/10 text-life-ai'
                        : 'border-life-ai/20 bg-card text-muted-foreground hover:bg-life-ai/5 hover:text-life-ai'
                    } disabled:cursor-default disabled:opacity-60`}
                    disabled={streaming || !speechSupported}
                    aria-label={listening ? '停止听写' : '开始语音听写'}
                    onClick={onToggleListening}
                  >
                    {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
                  </button>
                  <button
                    type="button"
                    className="grid size-10 cursor-pointer place-items-center rounded-2xl bg-life-ai text-background transition hover:bg-life-ai/90 disabled:cursor-default disabled:opacity-70"
                    disabled={!canSend}
                    aria-label="发送消息"
                    onClick={onSubmit}
                  >
                    {streaming ? (
                      <ActionLoadingIcon className="text-background" />
                    ) : (
                      <Send className="size-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AssistantToolsSheet
        open={toolsSheetOpen}
        quickActionLoading={quickActionLoading}
        weeklyReviewsLoading={weeklyReviewsLoading}
        weeklyReviewCount={weeklyReviews.length}
        aiActionCount={aiActions.length}
        latestPhotoDraft={latestPhotoDraft}
        onOpenChange={onToolsSheetOpenChange}
        onOpenWeeklyReviews={onOpenWeeklyReviews}
        onOpenHistory={onOpenHistory}
        onOpenActions={onOpenActions}
        onOpenPhotoAnalysis={onOpenPhotoAnalysis}
        onOpenPhotoItemDraft={onOpenPhotoItemDraft}
        onQuickAction={onQuickAction}
      />
    </div>
  );
}

function formatWeeklyReviewDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useAiPageState() {
  const preferredPantryHouseholdId = useLifeTraceStore((state) => state.preferredPantryHouseholdId);
  const preferredPantryHouseholdName = useLifeTraceStore(
    (state) => state.preferredPantryHouseholdName,
  );
  const plans = useLifeTraceStore((state) => state.plans);
  const traces = useLifeTraceStore((state) => state.traces);
  const checkins = useLifeTraceStore((state) => state.checkins);
  const checkinsDate = useLifeTraceStore((state) => state.checkinsDate);
  const checkinsLoading = useLifeTraceStore((state) => state.checkinsLoading);
  const settings = useLifeTraceStore((state) => state.settings);
  const settingsLoaded = useLifeTraceStore((state) => state.settingsLoaded);
  const aiActions = useLifeTraceStore((state) => state.aiActions ?? []);
  const addAiAction = useLifeTraceStore((state) => state.addAiAction);
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const receiveServerPlan = useLifeTraceStore((state) => state.receiveServerPlan);
  const receiveServerPantryItem = useLifeTraceStore((state) => state.receiveServerPantryItem);
  const receiveServerLedgerEntry = useLifeTraceStore((state) => state.receiveServerLedgerEntry);
  const loadAchievements = useLifeTraceStore((state) => state.loadAchievements);
  const loadAiActions = useLifeTraceStore((state) => state.loadAiActions);
  const loadCheckins = useLifeTraceStore((state) => state.loadCheckins);
  const loadPantryList = useLifeTraceStore((state) => state.loadPantryList);
  const pantryListSummary = useLifeTraceStore((state) => state.pantryListSummary);
  const generateTraceFromLatestPlan = useLifeTraceStore(
    (state) => state.generateTraceFromLatestPlan,
  );
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [recipeResult, setRecipeResult] = useState<RecipeSuggestionResponse | null>(null);
  const [adviceCards, setAdviceCards] = useState<AdvicePayload[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantConversations, setAssistantConversations] = useState<LifeAssistantConversation[]>(
    [],
  );
  const [activeAssistantConversationId, setActiveAssistantConversationId] = useState('');
  const [assistantConversationSheetOpen, setAssistantConversationSheetOpen] = useState(false);
  const [assistantToolsSheetOpen, setAssistantToolsSheetOpen] = useState(false);
  const [assistantConversationsLoading, setAssistantConversationsLoading] = useState(false);
  const [assistantConversationCreating, setAssistantConversationCreating] = useState(false);
  const [deletingAssistantConversationId, setDeletingAssistantConversationId] = useState<
    string | null
  >(null);
  const [assistantClearConfirmOpen, setAssistantClearConfirmOpen] = useState(false);
  const [assistantClearing, setAssistantClearing] = useState(false);
  const [assistantHistoryNotice, setAssistantHistoryNotice] = useState('');
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantHistoryLoading, setAssistantHistoryLoading] = useState(false);
  const [assistantModel, setAssistantModel] = useState('');
  const [assistantSpeechSupported, setAssistantSpeechSupported] = useState(false);
  const [assistantListening, setAssistantListening] = useState(false);
  const [assistantSpeechError, setAssistantSpeechError] = useState('');
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [photoItemHistory, setPhotoItemHistory] = useState<PhotoItemAnalysisHistoryItem[]>(() =>
    readPhotoItemAnalysisHistory(),
  );
  const [addingAdviceId, setAddingAdviceId] = useState<string | null>(null);
  const [addingRecipeId, setAddingRecipeId] = useState<string | null>(null);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReviewResponse[]>([]);
  const [weeklyReviewsLoading, setWeeklyReviewsLoading] = useState(false);
  const [weeklyReviewRegenerateTarget, setWeeklyReviewRegenerateTarget] =
    useState<WeeklyReviewResponse | null>(null);
  const [weeklyReviewDeleteTarget, setWeeklyReviewDeleteTarget] =
    useState<WeeklyReviewResponse | null>(null);
  const [deletingWeeklyReviewId, setDeletingWeeklyReviewId] = useState<string | null>(null);
  const [expandedWeeklyReviewId, setExpandedWeeklyReviewId] = useState<string | null>(null);
  const [addingWeeklyActionKey, setAddingWeeklyActionKey] = useState<string | null>(null);
  const assistantRecognitionRef = useRef<AssistantSpeechRecognition | null>(null);
  const assistantSpeechBaseRef = useRef('');

  const openPlanCount = plans.filter((plan) => !plan.completed).length;
  const completedPlanCount = plans.length - openPlanCount;
  const todayDate = useMemo(() => getLocalISODate(new Date()), []);
  const todayCheckins = checkinsDate === todayDate ? checkins : [];
  const completedCheckinCount = todayCheckins.filter((item) => item.completed).length;
  const latestWeeklyReview = weeklyReviews[0];
  const currentWeekReview = findCurrentWeekReview(weeklyReviews);
  const activeAssistantConversation =
    assistantConversations.find((item) => item.id === activeAssistantConversationId) ?? null;
  const locationLabel = formatLocationDisplay(settings.city) || settings.city;
  const weatherSummary = useMemo(() => {
    if (typeof window === 'undefined') {
      return settings.city;
    }
    const cached = readWeatherCache(window.localStorage, settings.city);
    if (!cached) {
      return settings.city;
    }
    return `${cached.now.temp}° ${cached.now.text}`;
  }, [settings.city]);
  const expiringPantryCount = pantryListSummary.expiring + pantryListSummary.expired;
  const pantryHouseholdLabel = preferredPantryHouseholdId
    ? preferredPantryHouseholdName || '当前共享空间'
    : '我的空间';

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadAiActions();
  }, [loadAiActions, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void loadPantryList({
      page: 1,
      pageSize: 20,
      status: 'all',
      category: 'all',
      householdId: preferredPantryHouseholdId || undefined,
    });
  }, [loadPantryList, preferredPantryHouseholdId, token]);

  useEffect(() => {
    if (!token || !settingsLoaded) {
      return;
    }

    void loadCheckins(todayDate);
  }, [loadCheckins, settingsLoaded, todayDate, token]);

  useEffect(() => {
    let cancelled = false;
    const refreshPhotoItemHistoryFromLocal = () =>
      setPhotoItemHistory(readPhotoItemAnalysisHistory());
    const refreshPhotoItemHistoryFromCloud = () => {
      void loadPhotoItemAnalysisHistory(token).then((items) => {
        if (!cancelled) {
          setPhotoItemHistory(items);
        }
      });
    };
    refreshPhotoItemHistoryFromCloud();

    window.addEventListener('focus', refreshPhotoItemHistoryFromCloud);
    window.addEventListener(
      PHOTO_ITEM_ANALYSIS_HISTORY_CHANGED_EVENT,
      refreshPhotoItemHistoryFromLocal,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshPhotoItemHistoryFromCloud();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', refreshPhotoItemHistoryFromCloud);
      window.removeEventListener(
        PHOTO_ITEM_ANALYSIS_HISTORY_CHANGED_EVENT,
        refreshPhotoItemHistoryFromLocal,
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  const handleRemovePhotoItemDraft = (draftId: string) => {
    void removePhotoItemAnalysisHistoryItem(token, draftId).then(setPhotoItemHistory);
    setPhotoItemHistory(readPhotoItemAnalysisHistory());
  };

  useEffect(() => {
    if (!token) {
      setAssistantMessages([]);
      setWeeklyReviews([]);
      return;
    }

    setWeeklyReviewsLoading(true);
    listWeeklyReviews(token)
      .then((data) => setWeeklyReviews(data.list))
      .catch(() => setWeeklyReviews([]))
      .finally(() => setWeeklyReviewsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setAssistantHistoryLoading(false);
      setAssistantMessages([]);
      setAssistantConversations([]);
      setActiveAssistantConversationId('');
      return;
    }

    let alive = true;
    setAssistantConversationsLoading(true);
    setAssistantHistoryLoading(true);
    listLifeAssistantConversations(token)
      .then((data) => {
        if (!alive) {
          return;
        }
        const conversationId = data.activeConversationId || data.list[0]?.id || '';
        setAssistantConversations(data.list);
        setActiveAssistantConversationId(conversationId);
        if (!conversationId) {
          setAssistantMessages([]);
          return null;
        }
        return getLifeAssistantConversationById(token, conversationId);
      })
      .then((data) => {
        if (!alive || !data) {
          return;
        }
        setAssistantHistoryNotice('');
        setAssistantConversations((items) => [
          data.conversation,
          ...items.filter((item) => item.id !== data.conversation.id),
        ]);
        setActiveAssistantConversationId(data.conversation.id);
        setAssistantMessages(data.messages.map(normalizeAssistantMessage));
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        setAssistantMessages([]);
        setAssistantConversations([]);
        setActiveAssistantConversationId('');
        setAssistantHistoryNotice('云端对话暂时同步失败，请稍后重试。');
      })
      .finally(() => {
        if (alive) {
          setAssistantConversationsLoading(false);
          setAssistantHistoryLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    const speechWindow = globalThis as typeof globalThis & {
      SpeechRecognition?: AssistantSpeechRecognitionCtor;
      webkitSpeechRecognition?: AssistantSpeechRecognitionCtor;
    };
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setAssistantSpeechSupported(false);
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'zh-CN';
    recognition.onstart = () => {
      setAssistantListening(true);
      setAssistantSpeechError('');
    };
    recognition.onend = () => {
      setAssistantListening(false);
    };
    recognition.onerror = (event) => {
      setAssistantListening(false);
      setAssistantSpeechError(
        event.error === 'not-allowed'
          ? '没有拿到麦克风权限，请检查系统授权。'
          : '语音听写暂时不可用，请稍后重试。',
      );
    };
    recognition.onresult = (event) => {
      let transcript = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.length) {
          continue;
        }
        transcript += result[0]?.transcript ?? '';
      }
      const nextValue = `${assistantSpeechBaseRef.current}${transcript}`.trim();
      setAssistantInput(nextValue);
    };

    assistantRecognitionRef.current = recognition;
    setAssistantSpeechSupported(true);
    return () => {
      recognition.onstart = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.onresult = null;
      recognition.stop();
      assistantRecognitionRef.current = null;
    };
  }, []);

  const saveAssistantMessageToServer = async (
    message: Pick<LifeAssistantMessage, 'role' | 'content'>,
    conversationId = activeAssistantConversationId,
  ) => {
    if (!token || !message.content.trim() || !conversationId) {
      return;
    }

    try {
      const saved = await saveLifeAssistantMessage(token, message, conversationId);
      void loadAchievements({ notifyNew: true });
      if (message.role === 'user') {
        const title = message.content.trim().slice(0, 32);
        setAssistantConversations((items) =>
          items.map((item) =>
            item.id === saved.conversationId
              ? { ...item, title, updatedAt: saved.createdAt }
              : item,
          ),
        );
      }
    } catch {
      // Keep the conversation usable even when persistence is temporarily unavailable.
    }
  };

  const handleSelectAssistantConversation = async (conversation: LifeAssistantConversation) => {
    if (!token || assistantStreaming) {
      return;
    }
    if (conversation.id === activeAssistantConversationId) {
      setAssistantConversationSheetOpen(false);
      return;
    }

    setAssistantHistoryLoading(true);
    try {
      const data = await getLifeAssistantConversationById(token, conversation.id);
      setActiveAssistantConversationId(data.conversation.id);
      setAssistantConversations((items) => [
        data.conversation,
        ...items.filter((item) => item.id !== data.conversation.id),
      ]);
      setAssistantMessages(data.messages.map(normalizeAssistantMessage));
      setResult(null);
      setRecipeResult(null);
      setAdviceCards([]);
      setAssistantModel('');
      setAssistantHistoryNotice('');
      setAssistantConversationSheetOpen(false);
    } catch {
      setAssistantHistoryNotice('切换话题失败，请稍后重试。');
    } finally {
      setAssistantHistoryLoading(false);
    }
  };

  const createAssistantConversationLocally = async ({ resetInput = false } = {}) => {
    if (!token) {
      throw new Error('请先登录');
    }

    const conversation = await createLifeAssistantConversation(token);
    setAssistantConversations((items) => [
      conversation,
      ...items.filter((item) => item.id !== conversation.id),
    ]);
    setActiveAssistantConversationId(conversation.id);
    setAssistantMessages([]);
    setResult(null);
    setRecipeResult(null);
    setAdviceCards([]);
    setAssistantModel('');
    if (resetInput) {
      setAssistantInput('');
    }
    setAssistantHistoryNotice('');
    setAssistantConversationSheetOpen(false);
    return conversation;
  };

  const handleCreateAssistantConversation = async () => {
    if (!token || assistantStreaming) {
      return;
    }

    setAssistantConversationCreating(true);
    try {
      await createAssistantConversationLocally({ resetInput: true });
    } catch {
      setAssistantHistoryNotice('新话题创建失败，请稍后重试。');
    } finally {
      setAssistantConversationCreating(false);
    }
  };

  const handleDeleteAssistantConversation = async (conversation: LifeAssistantConversation) => {
    if (!token || assistantStreaming || assistantConversations.length <= 1) {
      return;
    }

    setDeletingAssistantConversationId(conversation.id);
    try {
      const data = await deleteLifeAssistantConversation(token, conversation.id);
      const remaining = assistantConversations.filter((item) => item.id !== conversation.id);
      setAssistantConversations(remaining);

      if (conversation.id === activeAssistantConversationId) {
        const nextId = data.nextConversationId || remaining[0]?.id || '';
        setActiveAssistantConversationId(nextId);
        if (nextId) {
          const next = await getLifeAssistantConversationById(token, nextId);
          setAssistantConversations((items) => [
            next.conversation,
            ...items.filter((item) => item.id !== next.conversation.id),
          ]);
          setAssistantMessages(next.messages.map(normalizeAssistantMessage));
        } else {
          setAssistantMessages([]);
        }
        setResult(null);
        setRecipeResult(null);
        setAdviceCards([]);
        setAssistantModel('');
      }
    } catch {
      setAssistantHistoryNotice('删除话题失败，请稍后重试。');
    } finally {
      setDeletingAssistantConversationId(null);
    }
  };

  const handleAssistantActionEvent = (event: LifeAssistantActionEvent) => {
    const assistantActionMessage = formatAssistantActionMessage(event);
    setAssistantMessages((items) => {
      const targetIndex = [...items]
        .map((item, index) => ({ item, index }))
        .reverse()
        .find((entry) => entry.item.role === 'assistant')?.index;
      if (targetIndex === undefined) {
        return items;
      }

      return items.map((item, index) =>
        index === targetIndex ? { ...item, content: assistantActionMessage } : item,
      );
    });

    if (event.type === 'create_plan') {
      if (event.plan) {
        receiveServerPlan(
          event.plan,
          event.status === 'created'
            ? `生活助理创建了「${event.plan.title}」计划`
            : `生活助理识别到「${event.plan.title}」计划`,
        );
      }

      setResult({
        title:
          event.status === 'created'
            ? '已创建生活计划'
            : event.status === 'exists'
              ? '计划已存在'
              : event.status === 'need_more_info'
                ? '还差一点信息'
                : '生活计划未保存',
        detail:
          event.plan && event.status === 'created'
            ? `「${event.plan.title}」已加入计划，会在 ${formatPlanDisplayTime(event.plan)} 提醒。`
            : event.message,
        tone:
          event.status === 'error' ? 'alert' : event.status === 'need_more_info' ? 'ai' : 'plan',
      });
      return;
    }

    if (event.type === 'create_ledger_entry') {
      if (event.ledgerEntry) {
        receiveServerLedgerEntry(
          event.ledgerEntry,
          event.status === 'created'
            ? `生活助理记下了「${event.ledgerEntry.category}」账目`
            : `生活助理识别到「${event.ledgerEntry.category}」账目`,
        );
      }

      setResult({
        title:
          event.status === 'created'
            ? '已记账'
            : event.status === 'need_more_info'
              ? '还差一点信息'
              : '账目未保存',
        detail:
          event.ledgerEntry && event.status === 'created'
            ? `${formatLedgerAmount(event.ledgerEntry.amountCents, event.ledgerEntry.currency)} · ${event.ledgerEntry.category}`
            : event.message,
        tone:
          event.status === 'error' ? 'alert' : event.status === 'need_more_info' ? 'ai' : 'plan',
      });
      return;
    }

    if (event.pantryItem) {
      receiveServerPantryItem(
        event.pantryItem,
        event.status === 'created'
          ? `生活助理收进了「${event.pantryItem.name}」`
          : `生活助理识别到「${event.pantryItem.name}」库存`,
      );
    }

    setResult({
      title:
        event.status === 'created'
          ? '已加入库存'
          : event.status === 'exists'
            ? '库存已存在'
            : event.status === 'need_more_info'
              ? '还差一点信息'
              : '库存未保存',
      detail: event.message,
      tone: event.status === 'error' ? 'alert' : event.status === 'need_more_info' ? 'ai' : 'trace',
    });
  };

  const toggleAssistantListening = () => {
    if (assistantStreaming) {
      return;
    }

    if (!assistantSpeechSupported || !assistantRecognitionRef.current) {
      setAssistantSpeechError('当前浏览器暂不支持语音听写。');
      return;
    }

    if (assistantListening) {
      assistantRecognitionRef.current.stop();
      return;
    }

    assistantSpeechBaseRef.current = assistantInput.trim() ? `${assistantInput.trim()} ` : '';
    setAssistantSpeechError('');
    try {
      assistantRecognitionRef.current.start();
    } catch {
      setAssistantSpeechError('语音听写启动失败，请稍后再试。');
    }
  };

  const runWeeklyReview = async () => {
    setQuickActionLoading('每周回顾');
    setRecipeResult(null);
    try {
      if (!token) {
        throw new Error('请先登录后再生成服务端 AI 每周回顾');
      }
      if (!settings.aiPersonalization) {
        throw new Error('“我的”页的 AI 个性化开关未开启');
      }

      const review = await generateWeeklyReview(token);
      setResult({
        title: '服务端 AI 每周回顾已生成',
        detail: review.summary,
        tone: 'health',
        weeklyReview: {
          id: review.id,
          weekStart: review.weekStart,
          weekEnd: review.weekEnd,
          summary: review.summary,
          wins: review.wins,
          delays: review.delays,
          insights: review.insights,
          nextActions: review.nextActions,
        },
      });
      setWeeklyReviews((items) => [review, ...items.filter((item) => item.id !== review.id)]);
    } catch (error) {
      const habits = settings.habits ?? [];
      const reason = error instanceof Error ? error.message : '服务端 AI 暂时不可用';
      const detail = `未存档原因：${reason}。这次只生成本地回顾，不会进入历史周报。本周已有 ${traces.length} 条生活踪迹、${completedPlanCount} 个已完成计划。你最稳定的节奏是：${habits.slice(0, 3).join('、') || '保持记录'}。`;
      setResult({ title: '本地每周回顾（未存档）', detail, tone: 'health' });
    } finally {
      setQuickActionLoading(null);
    }
    addAiAction('生成了每周生活回顾');
  };

  const handleDeleteWeeklyReview = async () => {
    if (!weeklyReviewDeleteTarget) {
      return;
    }
    if (!token) {
      setResult({
        title: '请先登录',
        detail: '登录后才能删除已存档周报。',
        tone: 'alert',
      });
      return;
    }

    const target = weeklyReviewDeleteTarget;
    setDeletingWeeklyReviewId(target.id);
    try {
      await deleteWeeklyReview(token, target.id);
      setWeeklyReviews((items) => items.filter((item) => item.id !== target.id));
      setExpandedWeeklyReviewId((current) => (current === target.id ? null : current));
      setResult((previous) =>
        previous?.weeklyReview?.id === target.id
          ? {
              title: '历史周报已删除',
              detail: `${target.weekStart} 至 ${target.weekEnd} 的周报已从历史中删除。`,
              tone: 'health',
            }
          : previous,
      );
      setWeeklyReviewDeleteTarget(null);
    } catch (error) {
      setResult({
        title: '删除周报失败',
        detail: error instanceof Error ? error.message : '请稍后再试。',
        tone: 'alert',
      });
    } finally {
      setDeletingWeeklyReviewId(null);
    }
  };

  const handleQuickAction = async (label: string) => {
    if (label === '创建计划') {
      setDrawerOpen(true);
      setRecipeResult(null);
      setResult({
        title: '准备创建计划',
        detail: '填写标题、时间和提醒后，Life Trace 会把它加入计划列表。',
        tone: 'plan',
      });
      return;
    }

    if (label === '拍照分析商品') {
      navigate('/ai/photo-item-analysis');
      return;
    }

    if (label === '今日穿搭') {
      navigate('/closet');
      return;
    }

    if (label === '拍照识别衣物') {
      navigate('/ai/photo-clothing-analysis');
      return;
    }

    if (label === '智能菜谱') {
      setQuickActionLoading(label);
      setAdviceCards([]);
      setRecipeResult(null);
      setResult({
        title: '正在生成智能菜谱',
        detail: '正在读取当前 Pantry 食品库存。',
        tone: 'health',
      });
      try {
        if (!token) {
          throw new Error('请先登录后再生成智能菜谱');
        }
        if (!settings.aiPersonalization) {
          throw new Error('“我的”页的 AI 个性化开关未开启');
        }

        const recipes = await generateRecipeSuggestions(token, {
          meal: '晚餐',
          servings: 2,
          maxMinutes: 30,
          householdId: preferredPantryHouseholdId || undefined,
        });
        setRecipeResult(recipes);
        setResult({
          title: recipes.recipes.length > 0 ? '智能菜谱已生成' : '暂时没有可用菜谱',
          detail: recipes.summary,
          tone: recipes.recipes.length > 0 ? 'health' : 'alert',
        });
      } catch (error) {
        setResult({
          title: '智能菜谱生成失败',
          detail:
            error instanceof Error ? error.message : '请稍后再试，或先检查 Pantry 是否有食品库存。',
          tone: 'alert',
        });
      } finally {
        setQuickActionLoading(null);
      }
      addAiAction('生成了库存优先智能菜谱');
      return;
    }

    if (label === '生成今日建议') {
      setQuickActionLoading(label);
      setRecipeResult(null);
      try {
        if (!token || !settings.aiPersonalization) {
          throw new Error('use local advice');
        }

        const advice = await generateTodayAdvice(token);
        setAdviceCards(advice.list);
        const details = advice.list
          .slice(0, 3)
          .map((item) => `${item.title}：${item.detail}`)
          .join('；');
        setResult({
          title: '服务端 AI 今日建议已生成',
          detail: advice.summary || details,
          tone: 'ai',
        });
      } catch {
        setAdviceCards([]);
        const detail = `今天在${settings.city}，建议按 ${settings.workStart} 的上班时间提前安排${settings.commuteMethod}通勤。当前还有 ${openPlanCount} 个生活计划，适合优先完成一个轻量计划。`;
        setResult({ title: '今日建议已生成', detail, tone: 'ai' });
      } finally {
        setQuickActionLoading(null);
      }
      addAiAction('生成了今日生活建议');
      return;
    }

    if (label === '生成踪迹') {
      setRecipeResult(null);
      const trace = await generateTraceFromLatestPlan();

      setResult(
        trace
          ? {
              title: '已生成生活踪迹',
              detail: `已基于「${trace.title}」生成记录，可以到“踪迹”页查看。`,
              tone: 'trace',
            }
          : {
              title: '还没有可生成的内容',
              detail: '先创建或完成一个计划，Life AI 就能帮你沉淀成踪迹。',
              tone: 'alert',
            },
      );
      return;
    }

    if (label === '每周回顾') {
      if (currentWeekReview) {
        setWeeklyReviewRegenerateTarget(currentWeekReview);
        return;
      }
      await runWeeklyReview();
      return;
    }

    setRecipeResult(null);
    setResult({
      title: '暂不支持这个动作',
      detail: '可以先使用计划、踪迹、智能菜谱或拍照分析商品。',
      tone: 'alert',
    });
  };

  const handleAssistantSubmit = async (value = assistantInput) => {
    const message = value.trim();
    if (!message || assistantStreaming) {
      return;
    }

    if (!token) {
      setResult({
        title: '请先登录',
        detail: '登录后 Life Trace 才能读取你的计划、打卡和天气上下文。',
        tone: 'alert',
      });
      return;
    }

    if (assistantListening) {
      assistantRecognitionRef.current?.stop();
    }

    let conversationId = activeAssistantConversationId;
    if (!conversationId) {
      try {
        const conversation = await createAssistantConversationLocally();
        conversationId = conversation.id;
      } catch {
        setResult({
          title: '话题创建失败',
          detail: '暂时无法创建新的聊天话题，请稍后重试。',
          tone: 'alert',
        });
        return;
      }
    }

    const history = assistantMessages
      .filter((item) => item.content.trim())
      .slice(-6)
      .map(({ role, content }) => ({ role, content }));
    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setAssistantInput('');
    setAdviceCards([]);
    setRecipeResult(null);
    setAssistantModel('');
    setAssistantStreaming(true);
    setAssistantMessages((items) => [...items, userMessage, assistantMessage]);
    void saveAssistantMessageToServer({ role: 'user', content: message }, conversationId);

    let reply = '';
    let hasAssistantAction = false;
    let actionReply = '';

    try {
      await streamLifeAssistant(token, {
        message,
        history,
        householdId: preferredPantryHouseholdId || undefined,
        onMeta: (meta) => {
          if (meta.model) {
            setAssistantModel(meta.model);
          }
        },
        onChunk: (chunk) => {
          reply += chunk;
          setAssistantMessages((items) =>
            items.map((item) =>
              item.id === assistantId ? { ...item, content: item.content + chunk } : item,
            ),
          );
        },
        onAction: (event) => {
          hasAssistantAction = true;
          actionReply = formatAssistantActionMessage(event);
          handleAssistantActionEvent(event);
        },
      });
      setAssistantStreaming(false);
      void saveAssistantMessageToServer(
        { role: 'assistant', content: actionReply || reply },
        conversationId,
      );
      if (!hasAssistantAction) {
        addAiAction('和生活助理聊了一次安排');
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : '生活助理暂时没有回应';
      setAssistantMessages((items) =>
        items.map((item) =>
          item.id === assistantId
            ? {
                ...item,
                content:
                  reply.trim() ||
                  `刚才没有连接上生活助理。你可以稍后重试，我会继续基于天气、计划和打卡来安排。(${detail})`,
              }
            : item,
        ),
      );
      if (reply.trim()) {
        void saveAssistantMessageToServer({ role: 'assistant', content: reply }, conversationId);
      }
    } finally {
      setAssistantStreaming(false);
    }
  };

  const handleClearAssistantMessages = async () => {
    setAssistantClearing(true);
    if (token) {
      try {
        await clearLifeAssistantConversation(token);
      } catch {
        setResult({
          title: '清空对话失败',
          detail: '服务端暂时没有清空成功，请稍后重试。',
          tone: 'alert',
        });
        setAssistantClearing(false);
        return;
      }
    }
    setAssistantMessages([]);
    setResult(null);
    setRecipeResult(null);
    setAssistantModel('');
    setAssistantClearConfirmOpen(false);
    setAssistantClearing(false);
    setAssistantHistoryNotice('对话历史已清空');
  };

  const handleAddAdvicePlan = async (item: AdvicePayload) => {
    if (hasAdvicePlan(plans, item.id)) {
      setResult({
        title: '这条建议已在计划里',
        detail: `「${item.title}」已经加入过计划，不需要重复添加。`,
        tone: 'plan',
      });
      return;
    }

    setAddingAdviceId(item.id);
    try {
      const plan = await addPlan(
        createPlanFromAdvice({
          id: item.id,
          title: item.title,
          detail: item.detail,
          city: settings.city,
        }),
      );
      setResult(
        plan
          ? {
              title: '已加入今日计划',
              detail: `「${item.title}」已经变成可提醒的生活计划。`,
              tone: 'plan',
            }
          : {
              title: '计划保存失败',
              detail: '刚才的建议没有保存成功，请稍后再试。',
              tone: 'alert',
            },
      );
    } finally {
      setAddingAdviceId(null);
    }
  };

  const handleAddRecipePlan = async (recipe: RecipeSuggestionItem) => {
    const planTitle = recipe.planTitle || recipe.title;
    if (
      plans.some(
        (plan) => !plan.completed && plan.title === planTitle && plan.source === 'ai_advice',
      )
    ) {
      setResult({
        title: '菜谱计划已存在',
        detail: `「${planTitle}」已经在计划里了，不需要重复添加。`,
        tone: 'plan',
      });
      return;
    }

    setAddingRecipeId(recipe.id);
    try {
      const plan = await addPlan(createPlanFromRecipe(recipe));
      setResult(
        plan
          ? {
              title: '已加入晚餐计划',
              detail: `「${plan.title}」已经加入计划，做完后可以再确认库存消耗。`,
              tone: 'plan',
            }
          : {
              title: '计划保存失败',
              detail: '刚才的菜谱没有保存成计划，请稍后再试。',
              tone: 'alert',
            },
      );
    } finally {
      setAddingRecipeId(null);
    }
  };

  const handleAddWeeklyReviewActionPlan = async (
    review: WeeklyReviewResponse,
    action: string,
    actionIndex: number,
  ) => {
    if (hasWeeklyReviewActionPlan(plans, review.id, actionIndex)) {
      setResult({
        title: '计划已存在',
        detail: `「${action}」已经加入过计划，不需要重复添加。`,
        tone: 'plan',
      });
      return;
    }

    const actionKey = buildWeeklyReviewActionMarker(review.id, actionIndex);
    setAddingWeeklyActionKey(actionKey);
    try {
      const plan = await addPlan(
        createPlanFromWeeklyReviewAction({
          reviewId: review.id,
          action,
          actionIndex,
        }),
      );
      setResult(
        plan
          ? {
              title: '已加入下周计划',
              detail: `「${action}」已加入计划，会在 ${formatPlanDisplayTime(plan)} 提醒。`,
              tone: 'plan',
            }
          : {
              title: '计划保存失败',
              detail: '刚才的下周行动没有保存成功，请稍后再试。',
              tone: 'alert',
            },
      );
    } finally {
      setAddingWeeklyActionKey(null);
    }
  };

  return {
    plans,
    traces,
    checkinsLoading,
    settings,
    aiActions,
    navigate,
    drawerOpen,
    setDrawerOpen,
    result,
    recipeResult,
    adviceCards,
    assistantInput,
    setAssistantInput,
    assistantMessages,
    assistantConversations,
    activeAssistantConversationId,
    activeAssistantConversation,
    assistantConversationSheetOpen,
    setAssistantConversationSheetOpen,
    assistantToolsSheetOpen,
    setAssistantToolsSheetOpen,
    assistantConversationsLoading,
    assistantConversationCreating,
    deletingAssistantConversationId,
    assistantClearConfirmOpen,
    setAssistantClearConfirmOpen,
    assistantClearing,
    assistantHistoryNotice,
    setAssistantHistoryNotice,
    assistantStreaming,
    assistantHistoryLoading,
    assistantModel,
    assistantSpeechSupported,
    assistantListening,
    assistantSpeechError,
    preferredPantryHouseholdId,
    quickActionLoading,
    addingAdviceId,
    addingRecipeId,
    weeklyReviews,
    weeklyReviewsLoading,
    weeklyReviewRegenerateTarget,
    setWeeklyReviewRegenerateTarget,
    weeklyReviewDeleteTarget,
    setWeeklyReviewDeleteTarget,
    deletingWeeklyReviewId,
    expandedWeeklyReviewId,
    setExpandedWeeklyReviewId,
    addingWeeklyActionKey,
    openPlanCount,
    completedPlanCount,
    completedCheckinCount,
    latestWeeklyReview,
    photoItemHistory,
    handleRemovePhotoItemDraft,
    locationLabel,
    weatherSummary,
    pantryHouseholdLabel,
    expiringPantryCount,
    handleSelectAssistantConversation,
    handleCreateAssistantConversation,
    handleDeleteAssistantConversation,
    handleAssistantSubmit,
    toggleAssistantListening,
    handleClearAssistantMessages,
    handleAddAdvicePlan,
    handleAddRecipePlan,
    handleAddWeeklyReviewActionPlan,
    handleDeleteWeeklyReview,
    handleQuickAction,
    runWeeklyReview,
  };
}

export function AiHistoryPage() {
  const {
    assistantMessages,
    assistantHistoryLoading,
    assistantStreaming,
    assistantHistoryNotice,
    assistantClearConfirmOpen,
    setAssistantClearConfirmOpen,
    assistantClearing,
    handleClearAssistantMessages,
    navigate,
  } = useAiPageState();

  return (
    <>
      <AssistantHistoryPage
        messages={assistantMessages}
        loading={assistantHistoryLoading}
        streaming={assistantStreaming}
        notice={assistantHistoryNotice}
        onBack={() => navigate('/ai')}
        onRequestClear={() => setAssistantClearConfirmOpen(true)}
      />
      <ConfirmDialog
        open={assistantClearConfirmOpen}
        title="清空对话历史？"
        description="清空后，这个账号的生活助理对话记录会从云端删除。"
        confirmLabel="确认清空"
        loadingLabel="清空中"
        loading={assistantClearing}
        onCancel={() => {
          if (!assistantClearing) {
            setAssistantClearConfirmOpen(false);
          }
        }}
        onConfirm={() => void handleClearAssistantMessages()}
      />
    </>
  );
}

export function AiActionsPage() {
  const { aiActions, navigate } = useAiPageState();

  return <AiActionsArchive actions={aiActions} onBack={() => navigate('/ai')} />;
}

export function AiPhotoItemHistoryPage() {
  const { photoItemHistory, handleRemovePhotoItemDraft, navigate } = useAiPageState();

  return (
    <PhotoItemHistoryArchive
      items={photoItemHistory}
      onBack={() => navigate('/ai')}
      onOpenPhotoAnalysis={() => navigate('/ai/photo-item-analysis')}
      onOpenPhotoItemDraft={(draftId) =>
        navigate(`/ai/photo-item-analysis?draftId=${encodeURIComponent(draftId)}`)
      }
      onOpenSavedPantryItem={() => navigate('/pantry')}
      onRemovePhotoItemDraft={handleRemovePhotoItemDraft}
    />
  );
}

export function AiWeeklyReviewsPage() {
  const {
    plans,
    weeklyReviews,
    weeklyReviewsLoading,
    deletingWeeklyReviewId,
    expandedWeeklyReviewId,
    setExpandedWeeklyReviewId,
    setWeeklyReviewDeleteTarget,
    handleAddWeeklyReviewActionPlan,
    addingWeeklyActionKey,
    weeklyReviewDeleteTarget,
    handleDeleteWeeklyReview,
    navigate,
  } = useAiPageState();

  return (
    <>
      <WeeklyReviewsArchive
        reviews={weeklyReviews}
        loading={weeklyReviewsLoading}
        deletingId={deletingWeeklyReviewId}
        expandedId={expandedWeeklyReviewId}
        onBack={() => navigate('/ai')}
        onToggleExpanded={(review) =>
          setExpandedWeeklyReviewId((current) => toggleExpandedWeeklyReviewId(current, review.id))
        }
        onRequestDelete={setWeeklyReviewDeleteTarget}
        onAddNextAction={handleAddWeeklyReviewActionPlan}
        getNextActionAdded={(review, actionIndex) =>
          hasWeeklyReviewActionPlan(plans, review.id, actionIndex)
        }
        addingActionKey={addingWeeklyActionKey}
      />
      <ConfirmDialog
        open={Boolean(weeklyReviewDeleteTarget)}
        title="删除这篇周报？"
        description={
          weeklyReviewDeleteTarget
            ? `${weeklyReviewDeleteTarget.weekStart} 至 ${weeklyReviewDeleteTarget.weekEnd} 的周报删除后不会再出现在历史里。`
            : ''
        }
        confirmLabel="确认删除"
        loading={Boolean(deletingWeeklyReviewId)}
        onCancel={() => {
          if (!deletingWeeklyReviewId) {
            setWeeklyReviewDeleteTarget(null);
          }
        }}
        onConfirm={() => void handleDeleteWeeklyReview()}
      />
    </>
  );
}

export function AiPage() {
  const {
    plans,
    aiActions,
    navigate,
    drawerOpen,
    setDrawerOpen,
    result,
    recipeResult,
    adviceCards,
    assistantInput,
    setAssistantInput,
    assistantMessages,
    assistantConversations,
    activeAssistantConversationId,
    activeAssistantConversation,
    assistantConversationSheetOpen,
    setAssistantConversationSheetOpen,
    assistantToolsSheetOpen,
    setAssistantToolsSheetOpen,
    assistantConversationsLoading,
    assistantConversationCreating,
    deletingAssistantConversationId,
    assistantStreaming,
    assistantHistoryLoading,
    assistantModel,
    assistantSpeechSupported,
    assistantListening,
    assistantSpeechError,
    quickActionLoading,
    addingAdviceId,
    addingRecipeId,
    weeklyReviews,
    weeklyReviewsLoading,
    weeklyReviewRegenerateTarget,
    setWeeklyReviewRegenerateTarget,
    photoItemHistory,
    handleRemovePhotoItemDraft,
    locationLabel,
    weatherSummary,
    pantryHouseholdLabel,
    openPlanCount,
    completedCheckinCount,
    expiringPantryCount,
    handleSelectAssistantConversation,
    handleCreateAssistantConversation,
    handleDeleteAssistantConversation,
    handleAssistantSubmit,
    toggleAssistantListening,
    handleAddAdvicePlan,
    handleAddRecipePlan,
    handleQuickAction,
    runWeeklyReview,
  } = useAiPageState();

  return (
    <div className="h-full min-w-0 overflow-hidden">
      <AgentConversationPanel
        conversation={activeAssistantConversation}
        messages={assistantMessages}
        loading={assistantHistoryLoading}
        streaming={assistantStreaming}
        model={assistantModel}
        input={assistantInput}
        result={result}
        recipeResult={recipeResult}
        adviceCards={adviceCards}
        plans={plans}
        addingAdviceId={addingAdviceId}
        addingRecipeId={addingRecipeId}
        weeklyReviews={weeklyReviews}
        weeklyReviewsLoading={weeklyReviewsLoading}
        photoItemHistory={photoItemHistory}
        quickActionLoading={quickActionLoading}
        aiActions={aiActions}
        locationLabel={locationLabel}
        weatherSummary={weatherSummary}
        pantryHouseholdLabel={pantryHouseholdLabel}
        openPlanCount={openPlanCount}
        completedCheckinCount={completedCheckinCount}
        expiringPantryCount={expiringPantryCount}
        speechSupported={assistantSpeechSupported}
        listening={assistantListening}
        speechError={assistantSpeechError}
        onInputChange={setAssistantInput}
        onSubmit={() => void handleAssistantSubmit()}
        onPrompt={(prompt) =>
          prompt.type === '计划' ? setDrawerOpen(true) : void handleAssistantSubmit(prompt.title)
        }
        onToggleListening={toggleAssistantListening}
        onOpenConversations={() => setAssistantConversationSheetOpen(true)}
        onCreateConversation={() => void handleCreateAssistantConversation()}
        onOpenWeeklyReviews={() => navigate('/ai/weekly-reviews')}
        onOpenHistory={() => navigate('/ai/history')}
        onOpenPhotoAnalysis={() => navigate('/ai/photo-item-analysis')}
        onOpenPhotoItemHistory={() => navigate('/ai/photo-item-history')}
        onOpenPhotoItemDraft={(draftId) =>
          navigate(`/ai/photo-item-analysis?draftId=${encodeURIComponent(draftId)}`)
        }
        onOpenSavedPantryItem={() => navigate('/pantry')}
        onRemovePhotoItemDraft={handleRemovePhotoItemDraft}
        onOpenActions={() => navigate('/ai/actions')}
        toolsSheetOpen={assistantToolsSheetOpen}
        onToolsSheetOpenChange={setAssistantToolsSheetOpen}
        onAddAdvicePlan={(item) => void handleAddAdvicePlan(item)}
        onAddRecipePlan={(recipe) => void handleAddRecipePlan(recipe)}
        onQuickAction={(label) => void handleQuickAction(label)}
      />

      <AssistantConversationSheet
        open={assistantConversationSheetOpen}
        conversations={assistantConversations}
        activeConversationId={activeAssistantConversationId}
        loading={assistantConversationsLoading}
        creating={assistantConversationCreating}
        deletingId={deletingAssistantConversationId}
        onOpenChange={setAssistantConversationSheetOpen}
        onCreate={() => void handleCreateAssistantConversation()}
        onSelect={(conversation) => void handleSelectAssistantConversation(conversation)}
        onDelete={(conversation) => void handleDeleteAssistantConversation(conversation)}
      />

      <CreatePlanDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ConfirmDialog
        open={Boolean(weeklyReviewRegenerateTarget)}
        title="重新生成本周周报？"
        description={
          weeklyReviewRegenerateTarget
            ? `${weeklyReviewRegenerateTarget.weekStart} 至 ${weeklyReviewRegenerateTarget.weekEnd} 已有周报，重新生成会覆盖本周存档内容。`
            : ''
        }
        confirmLabel="重新生成"
        loadingLabel="生成中"
        loading={quickActionLoading === '每周回顾'}
        onCancel={() => {
          if (quickActionLoading !== '每周回顾') {
            setWeeklyReviewRegenerateTarget(null);
          }
        }}
        onConfirm={() => void runWeeklyReview().then(() => setWeeklyReviewRegenerateTarget(null))}
      />
    </div>
  );
}
