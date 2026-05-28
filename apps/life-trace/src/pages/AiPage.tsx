import {
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudSun,
  Image,
  ListChecks,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { generateTodayAdvice } from '@/api/advice';
import { type LifeAssistantMessage, streamLifeAssistant } from '@/api/assistant';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { ImageAnalysisDrawer } from '@/components/ImageAnalysisDrawer';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { aiQuickActions, suggestedPrompts } from '@/data/mock';
import { createPlanFromAdvice, hasAdvicePlan } from '@/lib/advicePlan';
import { buildPlanSchedule, getLocalISODate, type PlanDateOption } from '@/lib/planSchedule';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';
import type { AdvicePayload, NewPlanInput, PlanType } from '@/types';

type AiResult = {
  title: string;
  detail: string;
  tone: 'ai' | 'plan' | 'trace' | 'health' | 'alert';
};

type AssistantMessage = LifeAssistantMessage & {
  id: string;
};

type AssistantPlanDraft = {
  title: string;
  type: PlanType;
  scheduledTime: string;
  dateOption: PlanDateOption;
  notePrefix: string;
};

const reminderIntentPattern = /(提醒我|提醒|记得|别忘|预约|叫我|提示我)/;
const planIntentPattern =
  /(计划|安排|提醒我|提醒|记得|别忘|预约|看电影|电影|吃饭|吃|运动|跑步|健身|阅读|看书|聚会|见朋友|喝咖啡)/;

function normalizeClockTime(raw: string) {
  const match = raw.match(/([01]?\d|2[0-3])[:：点时]([0-5]\d)?/);
  if (!match) {
    return '';
  }

  const hour = match[1].padStart(2, '0');
  const minute = (match[2] ?? '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

function inferPlanType(text: string): PlanType {
  if (/电影|观影|影院/.test(text)) {
    return '电影';
  }
  if (/吃饭|吃|餐厅|火锅|咖啡|午饭|晚饭|早餐|午餐|晚餐/.test(text)) {
    return '吃饭';
  }
  if (/运动|跑步|健身|瑜伽|骑行|游泳/.test(text)) {
    return '运动';
  }
  if (/阅读|看书|读书/.test(text)) {
    return '阅读';
  }
  if (/聚会|见朋友|约朋友|约会/.test(text)) {
    return '聚会';
  }
  return '普通事项';
}

function inferPlanDateOption(text: string): PlanDateOption {
  if (/明天|明早|明晚/.test(text)) {
    return '明天';
  }
  if (/周日|星期日/.test(text)) {
    return '周日';
  }
  if (/周六|星期六|周末/.test(text)) {
    return '周六';
  }
  if (/周五|星期五/.test(text)) {
    return '周五';
  }
  return '今天';
}

function inferPlanTime(text: string, type: PlanType) {
  return (
    normalizeClockTime(text) ||
    (/早上|上午|明早/.test(text)
      ? '09:00'
      : /中午|午饭|午餐/.test(text)
        ? '12:00'
        : /下午/.test(text)
          ? '15:00'
          : /下班/.test(text)
            ? '18:30'
            : /晚上|今晚|明晚|晚饭|晚餐/.test(text)
              ? '19:30'
              : type === '吃饭'
                ? '12:00'
                : type === '电影' || type === '运动' || type === '聚会'
                  ? '19:30'
                  : '20:00')
  );
}

function buildAssistantPlanTitle(text: string, type: PlanType) {
  const fallbackByType: Record<PlanType, string> = {
    电影: '看电影',
    吃饭: '吃饭',
    运动: '运动',
    阅读: '阅读',
    聚会: '聚会',
    普通事项: '生活计划',
  };
  const title = text
    .replace(/今天|今晚|晚上|明天|明早|明晚|周末|周五|周六|周日|星期五|星期六|星期日/g, '')
    .replace(/早上|上午|中午|下午|下班后?/g, '')
    .replace(/([01]?\d|2[0-3])[:：点时]([0-5]\d)?/g, '')
    .replace(/提醒我|提醒|记得|别忘了?|叫我|提示我/g, '')
    .replace(/帮我|我要|想要|想|计划|安排|一下|去/g, '')
    .replace(/[，。,.、\s]+/g, '')
    .trim();

  return title || fallbackByType[type];
}

function buildAssistantPlanDraft(message: string): AssistantPlanDraft | null {
  const text = message.trim();
  if (!planIntentPattern.test(text)) {
    return null;
  }

  const type = inferPlanType(text);
  const title = buildAssistantPlanTitle(text, type);

  return {
    type,
    title,
    scheduledTime: inferPlanTime(text, type),
    dateOption: inferPlanDateOption(text),
    notePrefix: reminderIntentPattern.test(text) ? '来自生活助理提醒' : '来自生活助理计划',
  };
}

function buildAssistantPlanMarker(draft: AssistantPlanDraft) {
  return `#assistant-plan:${draft.dateOption}-${draft.scheduledTime}-${draft.type}-${draft.title}`;
}

function createPlanFromAssistantDraft(draft: AssistantPlanDraft): NewPlanInput {
  return {
    title: draft.title,
    type: draft.type,
    ...buildPlanSchedule({
      dateOption: draft.dateOption,
      time: draft.scheduledTime,
    }),
    reminder: true,
    source: 'ai_advice',
    note: `${draft.notePrefix}：${draft.title}。${buildAssistantPlanMarker(draft)}`,
  };
}

const ASSISTANT_MESSAGES_KEY = 'life-trace-assistant-messages';
const ASSISTANT_PENDING_PLAN_KEY = 'life-trace-assistant-pending-plan';
const ASSISTANT_RESULT_KEY = 'life-trace-assistant-result';
const COLLAPSED_ASSISTANT_MESSAGE_COUNT = 4;
const confirmPlanPattern = /^(可以|可以的|好|好的|确定|确认|没问题|就这样|行|安排|创建|加入计划)/;

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

function readPendingAssistantPlan() {
  try {
    const raw = localStorage.getItem(ASSISTANT_PENDING_PLAN_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as AssistantPlanDraft;
    if (
      typeof parsed?.title === 'string' &&
      typeof parsed?.scheduledTime === 'string' &&
      typeof parsed?.dateOption === 'string' &&
      typeof parsed?.type === 'string'
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
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

export function AiPage() {
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
  const addTrace = useLifeTraceStore((state) => state.addTrace);
  const loadCheckins = useLifeTraceStore((state) => state.loadCheckins);
  const generateTraceFromLatestPlan = useLifeTraceStore(
    (state) => state.generateTraceFromLatestPlan,
  );
  const token = useAuthStore((state) => state.token);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageDrawerOpen, setImageDrawerOpen] = useState(false);
  const [result, setResult] = useState<AiResult | null>(readAssistantResult);
  const [adviceCards, setAdviceCards] = useState<AdvicePayload[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantMessages, setAssistantMessages] =
    useState<AssistantMessage[]>(readAssistantMessages);
  const [pendingAssistantPlan, setPendingAssistantPlan] = useState<AssistantPlanDraft | null>(
    readPendingAssistantPlan,
  );
  const [showAllAssistantMessages, setShowAllAssistantMessages] = useState(false);
  const [assistantStreaming, setAssistantStreaming] = useState(false);
  const [assistantModel, setAssistantModel] = useState('');
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);
  const [addingAdviceId, setAddingAdviceId] = useState<string | null>(null);

  const openPlanCount = plans.filter((plan) => !plan.completed).length;
  const completedPlanCount = plans.length - openPlanCount;
  const todayDate = useMemo(() => getLocalISODate(new Date()), []);
  const todayCheckins = checkinsDate === todayDate ? checkins : [];
  const completedCheckinCount = todayCheckins.filter((item) => item.completed).length;
  const activeHabitCount = settings.habits.length;
  const latestTrace = traces[0];
  const visibleAssistantMessages = showAllAssistantMessages
    ? assistantMessages
    : assistantMessages.slice(-COLLAPSED_ASSISTANT_MESSAGE_COUNT);
  const hiddenAssistantMessageCount = Math.max(
    0,
    assistantMessages.length - visibleAssistantMessages.length,
  );

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
    localStorage.setItem(ASSISTANT_MESSAGES_KEY, JSON.stringify(assistantMessages.slice(-20)));
  }, [assistantMessages]);

  useEffect(() => {
    if (pendingAssistantPlan) {
      localStorage.setItem(ASSISTANT_PENDING_PLAN_KEY, JSON.stringify(pendingAssistantPlan));
      return;
    }

    localStorage.removeItem(ASSISTANT_PENDING_PLAN_KEY);
  }, [pendingAssistantPlan]);

  useEffect(() => {
    if (result) {
      localStorage.setItem(ASSISTANT_RESULT_KEY, JSON.stringify(result));
      return;
    }

    localStorage.removeItem(ASSISTANT_RESULT_KEY);
  }, [result]);

  const createAssistantPlan = async (draft: AssistantPlanDraft) => {
    setResult({
      title: '正在创建生活计划',
      detail: `生活助理已回复，正在把「${draft.title}」加入计划。`,
      tone: 'plan',
    });

    const marker = buildAssistantPlanMarker(draft);
    const existing = plans.some((plan) => plan.note.includes(marker));
    if (existing) {
      setResult({
        title: '计划已存在',
        detail: `「${draft.title}」已经在计划里。删除后可回复“创建”重新加入。`,
        tone: 'plan',
      });
      return;
    }

    const plan = await addPlan(createPlanFromAssistantDraft(draft));
    setPendingAssistantPlan(null);
    setResult(
      plan
        ? {
            title: '已创建生活计划',
            detail: `「${draft.title}」已加入计划，会在 ${plan.timeLabel} 提醒。`,
            tone: 'plan',
          }
        : {
            title: '生活计划未保存',
            detail: '生活助理已回复，但计划保存失败，请稍后再试。',
            tone: 'alert',
          },
    );
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
      const habits = settings.habits ?? [];
      const detail = `本周已有 ${traces.length} 条生活踪迹、${completedPlanCount} 个已完成计划。你最稳定的节奏是：${habits.slice(0, 3).join('、') || '保持记录'}。`;
      setResult({ title: '每周回顾已生成', detail, tone: 'health' });
      addAiAction('生成了每周生活回顾');
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
    };
    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: AssistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
    };

    setAssistantInput('');
    setAdviceCards([]);
    setAssistantModel('');
    setAssistantStreaming(true);
    setAssistantMessages((items) => [...items, userMessage, assistantMessage]);

    let reply = '';
    const confirmedPendingPlan =
      pendingAssistantPlan && confirmPlanPattern.test(message) ? pendingAssistantPlan : null;
    const planDraft = confirmedPendingPlan ?? buildAssistantPlanDraft(message);
    if (planDraft) {
      setPendingAssistantPlan(planDraft);
    }

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
      });
      setAssistantStreaming(false);
      if (planDraft) {
        await createAssistantPlan(planDraft);
      }
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
    } finally {
      setAssistantStreaming(false);
    }
  };

  const handleClearAssistantMessages = () => {
    setAssistantMessages([]);
    setPendingAssistantPlan(null);
    setResult(null);
    setAssistantModel('');
    setShowAllAssistantMessages(false);
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

  return (
    <div className="space-y-7">
      <header className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-life-ai/10 text-life-ai">
            <Sparkles className="size-6" />
          </div>
          <span className="text-2xl font-bold">Life AI</span>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">今天想怎么安排生活?</h1>
          <p className="mt-2 text-muted-foreground">{placeholder}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3">
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
            className="grid size-12 cursor-pointer place-items-center rounded-2xl bg-life-ai text-background transition hover:bg-life-ai/90 disabled:cursor-default disabled:opacity-80"
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
                {showAllAssistantMessages
                  ? `已展开 ${assistantMessages.length} 条本地记录`
                  : hiddenAssistantMessageCount
                    ? `显示最近 ${visibleAssistantMessages.length} 条，已收起 ${hiddenAssistantMessageCount} 条`
                    : `共 ${assistantMessages.length} 条本地记录`}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {assistantMessages.length > COLLAPSED_ASSISTANT_MESSAGE_COUNT ? (
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                  onClick={() => setShowAllAssistantMessages((value) => !value)}
                >
                  {showAllAssistantMessages ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                  {showAllAssistantMessages ? '收起' : '展开'}
                </button>
              ) : null}
              <button
                type="button"
                className="grid size-9 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                aria-label="清空最近对话"
                onClick={handleClearAssistantMessages}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {visibleAssistantMessages.map((message) => {
            const isUser = message.role === 'user';
            const Icon = isUser ? UserRound : Bot;

            return (
              <Card
                key={message.id}
                className={`p-4 ${isUser ? 'border-border bg-card/80' : 'border-life-ai/20 bg-life-ai/5'}`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${
                      isUser ? 'bg-secondary text-foreground' : 'bg-life-ai/15 text-life-ai'
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {isUser ? '你' : 'Life Trace 生活助理'}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {message.content ||
                        (assistantStreaming ? '正在结合今日状态整理安排...' : '暂无回复')}
                      {!isUser &&
                      assistantStreaming &&
                      message.id === assistantMessages[assistantMessages.length - 1]?.id ? (
                        <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-life-ai align-[-2px]" />
                      ) : null}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      ) : null}

      {result ? (
        <Card className="border-life-ai/20 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="size-5 text-life-ai" />
            <Badge tone={result.tone}>Life AI</Badge>
          </div>
          <h2 className="text-lg font-semibold">{result.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{result.detail}</p>
        </Card>
      ) : null}

      {adviceCards.length > 0 ? (
        <section>
          <SectionHeader title="AI 生成的今日建议" meta={`${adviceCards.length} 条`} />
          <div className="mt-3 grid grid-cols-2 gap-3">
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
        <div className="flex flex-wrap gap-3">
          {aiQuickActions.map((action) => {
            const Icon = action.icon;
            const loading = quickActionLoading === action.label;

            return (
              <button
                type="button"
                key={action.label}
                className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:bg-secondary disabled:cursor-default disabled:opacity-70"
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
        <SectionHeader title="最近的 AI 操作" meta="查看全部" />
        <div className="space-y-3">
          {aiActions.slice(0, 5).map((action) => (
            <Card key={action.id} className="flex items-center gap-4 p-4">
              <div className="grid size-10 place-items-center rounded-full bg-life-trace/10 text-life-trace">
                {action.title.includes('计划') ? (
                  <CalendarDays className="size-5" />
                ) : action.title.includes('图片') ? (
                  <Image className="size-5" />
                ) : (
                  <Sparkles className="size-5" />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{action.title}</h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {action.timeLabel}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <CreatePlanDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
      <ImageAnalysisDrawer
        open={imageDrawerOpen}
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
    </div>
  );
}
