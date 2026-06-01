import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  CloudSun,
  History,
  Image,
  Lightbulb,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteWeeklyReview,
  generateTodayAdvice,
  generateWeeklyReview,
  listWeeklyReviews,
  type WeeklyReviewResponse,
} from '@/api/advice';
import {
  clearLifeAssistantConversation,
  getLifeAssistantConversation,
  type LifeAssistantMessage,
  type LifeAssistantPlanEvent,
  saveLifeAssistantMessage,
  streamLifeAssistant,
} from '@/api/assistant';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { AssistantMessageCard } from '@/components/AssistantMessageCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { EmptyState } from '@/components/EmptyState';
import { ImageAnalysisDrawer } from '@/components/ImageAnalysisDrawer';
import { SectionHeader } from '@/components/SectionHeader';
import { MessageSyncSkeleton, SyncState } from '@/components/SyncState';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { aiQuickActions, suggestedPrompts } from '@/data/mock';
import { createPlanFromAdvice, hasAdvicePlan } from '@/lib/advicePlan';
import { getPlanDisplayTimeParts } from '@/lib/planReminder';
import { getLocalISODate } from '@/lib/planSchedule';
import {
  buildWeeklyReviewActionMarker,
  createPlanFromWeeklyReviewAction,
  hasWeeklyReviewActionPlan,
} from '@/lib/weeklyReviewPlan';
import { findCurrentWeekReview, toggleExpandedWeeklyReviewId } from '@/lib/weeklyReviews';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { AdvicePayload, AiAction, NewPlanInput } from '@/types';

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

function formatPlanDisplayTime(
  plan: Pick<NewPlanInput, 'scheduledDate' | 'scheduledTime' | 'timeLabel'>,
) {
  const { dateText, timeText } = getPlanDisplayTimeParts(plan);
  return `${dateText} ${timeText}`;
}

const ASSISTANT_MESSAGES_KEY = 'life-trace-assistant-messages';
const ASSISTANT_RESULT_KEY = 'life-trace-assistant-result';
const COLLAPSED_ASSISTANT_MESSAGE_COUNT = 4;

function normalizeAssistantMessage(message: LifeAssistantMessage, index: number): AssistantMessage {
  return {
    id: message.id || `${message.role}-${message.createdAt || Date.now()}-${index}`,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
  };
}

function getAssistantMessageDate(message: AssistantMessage) {
  if (message.createdAt) {
    const date = new Date(message.createdAt);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const timestamp = message.id.match(/(?:user|assistant)-(\d+)/)?.[1];
  if (timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
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

function getAssistantHistoryGroupLabel(message: AssistantMessage, now = new Date()) {
  const date = getAssistantMessageDate(message);
  if (!date) {
    return '更早';
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfMessageDay) / 86400000);

  if (dayDiff === 0) {
    return '今天';
  }
  if (dayDiff === 1) {
    return '昨天';
  }
  if (dayDiff < 7) {
    return `${dayDiff} 天前`;
  }
  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });
}

function groupAssistantMessages(messages: AssistantMessage[]) {
  const groups: Array<{ label: string; messages: AssistantMessage[] }> = [];

  for (const message of messages) {
    const label = getAssistantHistoryGroupLabel(message);
    const latestGroup = groups[groups.length - 1];
    if (latestGroup?.label === label) {
      latestGroup.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }

  return groups;
}

function readAssistantMessages() {
  try {
    const raw = localStorage.getItem(ASSISTANT_MESSAGES_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as AssistantMessage[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item) =>
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.id === 'string' &&
            typeof item.content === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function readAssistantResult() {
  try {
    const raw = localStorage.getItem(ASSISTANT_RESULT_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AiResult;
    if (
      typeof parsed?.title === 'string' &&
      typeof parsed?.detail === 'string' &&
      ['ai', 'plan', 'trace', 'health', 'alert'].includes(parsed.tone)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
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
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <header className="space-y-5">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          返回
        </button>
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-life-health/10 text-life-health">
            <History className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight max-[360px]:text-2xl">历史周报</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {loading ? '正在同步已存档周报' : `已存档 ${reviews.length} 篇`}
            </p>
          </div>
        </div>
      </header>

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
    </div>
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
  const groups = groupAssistantMessages(messages);

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <header className="space-y-5">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          返回
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
                <History className="size-5" />
              </div>
              <span className="text-2xl font-bold max-[360px]:text-xl">对话历史</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {loading ? '正在同步云端对话' : `${messages.length} 条生活助理记录`}
            </p>
          </div>
          <button
            type="button"
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-life-alert/10 hover:text-life-alert disabled:cursor-default disabled:opacity-50"
            aria-label="清空对话历史"
            disabled={loading || messages.length === 0}
            onClick={onRequestClear}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </header>

      {notice ? (
        <Card className="border-life-trace/20 bg-life-trace/10 p-4 text-sm font-semibold text-life-trace">
          {notice}
        </Card>
      ) : null}

      <section>
        <SectionHeader title="全部对话" meta={loading ? '同步中' : `${messages.length} 条`} />
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
    </div>
  );
}

function AiActionCard({ action }: { action: AiAction }) {
  const Icon = action.title.includes('计划')
    ? CalendarDays
    : action.title.includes('图片')
      ? Image
      : Sparkles;

  return (
    <Card className="flex items-center gap-4 p-4">
      <div className="grid size-10 shrink-0 place-items-center rounded-full bg-life-trace/10 text-life-trace">
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 font-semibold">{action.title}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {action.timeLabel}
        </div>
      </div>
    </Card>
  );
}

function AiActionsArchive({ actions, onBack }: { actions: AiAction[]; onBack: () => void }) {
  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <header className="space-y-5">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          返回
        </button>
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
            <Sparkles className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight max-[360px]:text-2xl">AI 操作历史</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              共 {actions.length} 条 Life AI 记录
            </p>
          </div>
        </div>
      </header>

      {actions.length > 0 ? (
        <div className="space-y-3">
          {actions.map((action) => (
            <AiActionCard key={action.id} action={action} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="还没有 AI 操作"
          description="生成建议、分析图片、创建计划后，这里会沉淀最近的 AI 操作。"
          eyebrow="Life AI"
          icon={Sparkles}
          tone="ai"
          align="center"
        />
      )}
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
  const addTrace = useLifeTraceStore((state) => state.addTrace);
  const loadCheckins = useLifeTraceStore((state) => state.loadCheckins);
  const generateTraceFromLatestPlan = useLifeTraceStore(
    (state) => state.generateTraceFromLatestPlan,
  );
  const token = useAuthStore((state) => state.token);
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageDrawerOpen, setImageDrawerOpen] = useState(false);
  const [result, setResult] = useState<AiResult | null>(readAssistantResult);
  const [adviceCards, setAdviceCards] = useState<AdvicePayload[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] =
    useState<AssistantMessage[]>(readAssistantMessages);
  const [assistantClearConfirmOpen, setAssistantClearConfirmOpen] = useState(false);
  const [assistantClearing, setAssistantClearing] = useState(false);
  const [assistantHistoryNotice, setAssistantHistoryNotice] = useState('');
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantHistoryLoading, setAssistantHistoryLoading] = useState(false);
  const [assistantModel, setAssistantModel] = useState('');
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [addingAdviceId, setAddingAdviceId] = useState<string | null>(null);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReviewResponse[]>([]);
  const [weeklyReviewsLoading, setWeeklyReviewsLoading] = useState(false);
  const [weeklyReviewRegenerateTarget, setWeeklyReviewRegenerateTarget] =
    useState<WeeklyReviewResponse | null>(null);
  const [weeklyReviewDeleteTarget, setWeeklyReviewDeleteTarget] =
    useState<WeeklyReviewResponse | null>(null);
  const [deletingWeeklyReviewId, setDeletingWeeklyReviewId] = useState<string | null>(null);
  const [expandedWeeklyReviewId, setExpandedWeeklyReviewId] = useState<string | null>(null);
  const [addingWeeklyActionKey, setAddingWeeklyActionKey] = useState<string | null>(null);

  const openPlanCount = plans.filter((plan) => !plan.completed).length;
  const completedPlanCount = plans.length - openPlanCount;
  const todayDate = useMemo(() => getLocalISODate(new Date()), []);
  const todayCheckins = checkinsDate === todayDate ? checkins : [];
  const completedCheckinCount = todayCheckins.filter((item) => item.completed).length;
  const activeHabitCount = settings.habits.length;
  const latestTrace = traces[0];
  const latestAssistantMessages = assistantMessages.slice(-COLLAPSED_ASSISTANT_MESSAGE_COUNT);
  const latestWeeklyReview = weeklyReviews[0];
  const currentWeekReview = findCurrentWeekReview(weeklyReviews);
  const placeholder = useMemo(
    () => `${settings.city} · ${settings.commuteMethod}通勤 · ${openPlanCount} 个待完成计划`,
    [openPlanCount, settings.city, settings.commuteMethod],
  );

  useEffect(() => {
    if (!token || !settingsLoaded) {
      return;
    }

    void loadCheckins(todayDate);
  }, [loadCheckins, settingsLoaded, todayDate, token]);

  useEffect(() => {
    if (!token) {
      setAssistantMessages(readAssistantMessages());
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
      return;
    }

    let alive = true;
    setAssistantHistoryLoading(true);
    getLifeAssistantConversation(token)
      .then((data) => {
        if (!alive) {
          return;
        }
        setAssistantMessages(data.messages.map(normalizeAssistantMessage));
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        setAssistantMessages(readAssistantMessages());
      })
      .finally(() => {
        if (alive) {
          setAssistantHistoryLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    localStorage.setItem(ASSISTANT_MESSAGES_KEY, JSON.stringify(assistantMessages.slice(-20)));
  }, [assistantMessages]);

  useEffect(() => {
    if (result) {
      localStorage.setItem(ASSISTANT_RESULT_KEY, JSON.stringify(result));
      return;
    }

    localStorage.removeItem(ASSISTANT_RESULT_KEY);
  }, [result]);

  const saveAssistantMessageToServer = async (
    message: Pick<LifeAssistantMessage, 'role' | 'content'>,
  ) => {
    if (!token || !message.content.trim()) {
      return;
    }

    try {
      await saveLifeAssistantMessage(token, message);
    } catch {
      // Keep the conversation usable even when persistence is temporarily unavailable.
    }
  };

  const handleAssistantPlanEvent = (event: LifeAssistantPlanEvent) => {
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
            : '生活计划未保存',
      detail:
        event.plan && event.status === 'created'
          ? `「${event.plan.title}」已加入计划，会在 ${formatPlanDisplayTime(event.plan)} 提醒。`
          : event.message,
      tone: event.status === 'error' ? 'alert' : 'plan',
    });
  };

  const runWeeklyReview = async () => {
    setQuickActionLoading('每周回顾');
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
      setResult({
        title: '准备创建计划',
        detail: '填写标题、时间和提醒后，Life Trace 会把它加入计划列表。',
        tone: 'plan',
      });
      return;
    }

    if (label === '生成今日建议') {
      setQuickActionLoading(label);
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

    setImageDrawerOpen(true);
    setResult({
      title: '准备分析图片',
      detail: '上传图片或粘贴图片链接后，可以生成生活计划或直接生成踪迹。',
      tone: 'trace',
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
    setAssistantModel('');
    setAssistantStreaming(true);
    setAssistantMessages((items) => [...items, userMessage, assistantMessage]);
    void saveAssistantMessageToServer({ role: 'user', content: message });

    let reply = '';

    try {
      await streamLifeAssistant(token, {
        message,
        history,
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
        onPlan: handleAssistantPlanEvent,
      });
      setAssistantStreaming(false);
      void saveAssistantMessageToServer({ role: 'assistant', content: reply });
      addAiAction('和生活助理规划了一次安排');
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
        void saveAssistantMessageToServer({ role: 'assistant', content: reply });
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
    addAiAction,
    addPlan,
    addTrace,
    token,
    navigate,
    drawerOpen,
    setDrawerOpen,
    imageDrawerOpen,
    setImageDrawerOpen,
    result,
    setResult,
    adviceCards,
    assistantInput,
    setAssistantInput,
    assistantMessages,
    assistantClearConfirmOpen,
    setAssistantClearConfirmOpen,
    assistantClearing,
    assistantHistoryNotice,
    setAssistantHistoryNotice,
    assistantStreaming,
    assistantHistoryLoading,
    assistantModel,
    quickActionLoading,
    addingAdviceId,
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
    activeHabitCount,
    latestTrace,
    latestAssistantMessages,
    latestWeeklyReview,
    placeholder,
    handleAssistantSubmit,
    handleClearAssistantMessages,
    handleAddAdvicePlan,
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
    traces,
    checkinsLoading,
    settings,
    aiActions,
    addAiAction,
    addPlan,
    addTrace,
    token,
    navigate,
    drawerOpen,
    setDrawerOpen,
    imageDrawerOpen,
    setImageDrawerOpen,
    result,
    setResult,
    adviceCards,
    assistantInput,
    setAssistantInput,
    assistantMessages,
    setAssistantHistoryNotice,
    assistantStreaming,
    assistantHistoryLoading,
    assistantModel,
    quickActionLoading,
    addingAdviceId,
    weeklyReviews,
    weeklyReviewsLoading,
    weeklyReviewRegenerateTarget,
    setWeeklyReviewRegenerateTarget,
    openPlanCount,
    completedPlanCount,
    completedCheckinCount,
    activeHabitCount,
    latestTrace,
    latestAssistantMessages,
    latestWeeklyReview,
    placeholder,
    handleAssistantSubmit,
    handleAddAdvicePlan,
    handleQuickAction,
    runWeeklyReview,
  } = useAiPageState();

  return (
    <div className="min-w-0 space-y-7 overflow-x-hidden">
      <header className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
            <Sparkles className="size-6" />
          </div>
          <span className="text-2xl font-bold">Life AI</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight max-[360px]:text-2xl">
            今天想怎么安排生活?
          </h1>
          <p className="mt-2 text-muted-foreground">{placeholder}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CloudSun className="size-4 text-life-weather" />
            今日上下文
          </div>
          <p className="mt-2 text-lg font-semibold">{settings.city}</p>
          <p className="mt-1 text-sm text-muted-foreground">{settings.commuteMethod}通勤</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <CalendarDays className="size-4 text-life-plan" />
            待完成计划
          </div>
          <p className="mt-2 text-lg font-semibold">{openPlanCount} 个</p>
          <p className="mt-1 text-sm text-muted-foreground">{completedPlanCount} 个已完成</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <ListChecks className="size-4 text-life-trace" />
            今日打卡
          </div>
          <p className="mt-2 text-lg font-semibold">
            {checkinsLoading ? '同步中' : `${completedCheckinCount}/${activeHabitCount || 0}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeHabitCount ? settings.habits.slice(0, 3).join('、') : '还未设置打卡项'}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-4 text-life-ai" />
            最近踪迹
          </div>
          <p className="mt-2 line-clamp-1 text-lg font-semibold">
            {latestTrace ? latestTrace.title : `${traces.length} 条`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {latestTrace ? latestTrace.mood : '完成计划后自动沉淀'}
          </p>
        </Card>
      </section>

      <Card className="border-life-ai/25 p-4 shadow-[0_0_36px_rgba(6,182,212,0.06)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">生活助理</p>
            <p className="mt-1 text-xs text-muted-foreground">
              会结合天气、计划、打卡和最近踪迹回答
            </p>
          </div>
          {assistantStreaming ? (
            <span className="inline-flex items-center gap-2 text-xs text-life-ai">
              <ActionLoadingIcon className="size-3.5" />
              正在安排
            </span>
          ) : null}
        </div>
        <textarea
          className="min-h-24 w-full resize-none rounded-2xl border border-life-ai/30 bg-secondary/40 px-4 py-3 text-base leading-7 outline-none transition placeholder:text-muted-foreground focus:border-life-ai/70 focus:bg-secondary focus:shadow-[0_0_0_3px_rgba(6,182,212,0.08)]"
          value={assistantInput}
          disabled={assistantStreaming}
          placeholder="例如：帮我安排今天下班后的时间，顺便提醒我该注意什么"
          onChange={(event) => setAssistantInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleAssistantSubmit();
            }
          }}
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-xs text-muted-foreground">
            {assistantModel ? `当前由生活助理生成` : '输入后会流式生成，不用等待整段返回'}
          </p>
          <button
            type="button"
            className="grid size-12 shrink-0 cursor-pointer place-items-center rounded-2xl bg-life-ai text-background transition hover:bg-life-ai/90 disabled:cursor-default disabled:opacity-80"
            disabled={assistantStreaming || !assistantInput.trim()}
            onClick={() => void handleAssistantSubmit()}
          >
            {assistantStreaming ? (
              <ActionLoadingIcon className="text-background" />
            ) : (
              <Send className="size-5" />
            )}
          </button>
        </div>
      </Card>

      {assistantMessages.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">最近对话</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {assistantHistoryLoading
                  ? '正在同步云端对话'
                  : `最近 ${latestAssistantMessages.length} 条 / 共 ${assistantMessages.length} 条`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                onClick={() => {
                  setAssistantHistoryNotice('');
                  navigate('/ai/history');
                }}
              >
                <History className="size-3.5" />
                历史
              </button>
            </div>
          </div>

          {latestAssistantMessages.map((message) => (
            <AssistantMessageCard
              key={message.id}
              message={message}
              streaming={
                assistantStreaming &&
                message.id === assistantMessages[assistantMessages.length - 1]?.id
              }
            />
          ))}
        </section>
      ) : null}

      {result ? (
        <Card className="border-life-ai/20 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-5 text-life-ai" />
            <Badge tone={result.tone}>Life AI</Badge>
          </div>
          <h2 className="text-lg font-semibold">{result.title}</h2>
          {result.weeklyReview ? (
            <div className="mt-4">
              <WeeklyReviewPanel review={result.weeklyReview} />
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.detail}</p>
          )}
        </Card>
      ) : null}

      <section>
        <SectionHeader
          title="历史周报"
          meta={weeklyReviewsLoading ? '同步中' : `${weeklyReviews.length} 篇`}
        />
        <button
          type="button"
          className="flex w-full cursor-pointer items-center gap-4 rounded-[1.25rem] border border-life-health/20 bg-card p-4 text-left transition hover:bg-secondary"
          onClick={() => navigate('/ai/weekly-reviews')}
        >
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-health/10 text-life-health">
            <History className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold">查看历史周报</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {weeklyReviewsLoading
                ? '正在同步已存档周报'
                : latestWeeklyReview
                  ? `${latestWeeklyReview.weekStart} - ${latestWeeklyReview.weekEnd}`
                  : '生成服务端 AI 每周回顾后会保存到这里'}
            </p>
          </div>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </section>

      {adviceCards.length > 0 ? (
        <section>
          <SectionHeader title="AI 生成的今日建议" meta={`${adviceCards.length} 条`} />
          <div className="mt-3 grid grid-cols-2 gap-3 max-[360px]:grid-cols-1">
            {adviceCards.map((item) => {
              const added = hasAdvicePlan(plans, item.id);
              const adding = addingAdviceId === item.id;

              return (
                <Card key={item.id} className="relative min-h-36 overflow-hidden p-4">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-life-ai/40 to-transparent"
                  />
                  <div className="flex items-start justify-between gap-3">
                    <Badge tone={item.tone}>{item.title}</Badge>
                    <button
                      type="button"
                      disabled={added || Boolean(addingAdviceId)}
                      className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-secondary text-foreground transition hover:bg-accent disabled:cursor-default disabled:text-life-trace disabled:opacity-100"
                      aria-label={added ? '已加入计划' : `添加${item.title}计划`}
                      onClick={() => void handleAddAdvicePlan(item)}
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
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {item.detail}
                  </p>
                </Card>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="pb-4">
        <SectionHeader title="快捷操作" />
        <div className="flex flex-wrap gap-3 max-[360px]:gap-2">
          {aiQuickActions.map((action) => {
            const Icon = action.icon;
            const loading = quickActionLoading === action.label;

            return (
              <button
                type="button"
                key={action.label}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:bg-secondary disabled:cursor-default disabled:opacity-70 max-[360px]:px-3"
                disabled={Boolean(quickActionLoading)}
                onClick={() => void handleQuickAction(action.label)}
              >
                {loading ? (
                  <ActionLoadingIcon className="size-4" />
                ) : (
                  <Icon className={`size-4 ${action.tone}`} />
                )}
                {action.label}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="试试这样说" />
        <div className="space-y-3">
          {suggestedPrompts.map((prompt) => {
            const Icon = prompt.icon;

            return (
              <button
                key={prompt.title}
                type="button"
                className="flex w-full cursor-pointer items-center gap-4 rounded-[1.25rem] border border-border bg-card p-4 text-left transition hover:bg-secondary"
                onClick={() =>
                  prompt.type === '计划'
                    ? setDrawerOpen(true)
                    : void handleAssistantSubmit(prompt.title)
                }
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
                  <Icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{prompt.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{prompt.type}</p>
                </div>
                <span className="text-muted-foreground">›</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 text-xl font-semibold">最近的 AI 操作</h2>
          <button
            type="button"
            className="cursor-pointer text-sm font-semibold text-muted-foreground transition hover:text-foreground"
            onClick={() => navigate('/ai/actions')}
          >
            查看全部
          </button>
        </div>
        <div className="space-y-3">
          {aiActions.slice(0, 5).map((action) => (
            <AiActionCard key={action.id} action={action} />
          ))}
        </div>
      </section>

      <CreatePlanDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ImageAnalysisDrawer
        open={imageDrawerOpen}
        token={token}
        onOpenChange={setImageDrawerOpen}
        onCreatePlan={(input) => {
          void addPlan(input);
          setResult({
            title: '已从图片生成计划',
            detail: `「${input.title}」已加入计划列表，完成后可以继续生成踪迹。`,
            tone: 'plan',
          });
        }}
        onCreateTrace={(input) => {
          void addTrace(input).then((trace) => {
            setResult(
              trace
                ? {
                    title: '已从图片生成踪迹',
                    detail: `「${input.title}」已加入踪迹流，可以到“踪迹”页查看。`,
                    tone: 'trace',
                  }
                : {
                    title: '踪迹保存失败',
                    detail: '刚才的图片分析结果没有保存成功，请稍后再试。',
                    tone: 'alert',
                  },
            );
          });
        }}
        onAnalyzed={(title) => addAiAction(title)}
      />
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
