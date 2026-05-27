import { CalendarDays, Clock, Image, Send, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { generateTodayAdvice } from '@/api/advice';
import { ActionLoadingIcon } from '@/components/ActionLoadingIcon';
import { CreatePlanDrawer } from '@/components/CreatePlanDrawer';
import { ImageAnalysisDrawer } from '@/components/ImageAnalysisDrawer';
import { SectionHeader } from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { aiQuickActions, suggestedPrompts } from '@/data/mock';
import { useAuthStore } from '@/store/useAuthStore';
import { useLifeTraceStore } from '@/store/useLifeTraceStore';

type AiResult = {
  title: string;
  detail: string;
  tone: 'ai' | 'plan' | 'trace' | 'health' | 'alert';
};

export function AiPage() {
  const plans = useLifeTraceStore((state) => state.plans);
  const traces = useLifeTraceStore((state) => state.traces);
  const settings = useLifeTraceStore((state) => state.settings);
  const aiActions = useLifeTraceStore((state) => state.aiActions ?? []);
  const addAiAction = useLifeTraceStore((state) => state.addAiAction);
  const addPlan = useLifeTraceStore((state) => state.addPlan);
  const addTrace = useLifeTraceStore((state) => state.addTrace);
  const generateTraceFromLatestPlan = useLifeTraceStore(
    (state) => state.generateTraceFromLatestPlan,
  );
  const token = useAuthStore((state) => state.token);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [imageDrawerOpen, setImageDrawerOpen] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [quickActionLoading, setQuickActionLoading] = useState<string | null>(null);

  const openPlanCount = plans.filter((plan) => !plan.completed).length;
  const completedPlanCount = plans.length - openPlanCount;

  const placeholder = useMemo(
    () => `${settings.city} · ${settings.commuteMethod}通勤 · ${openPlanCount} 个待完成计划`,
    [openPlanCount, settings.city, settings.commuteMethod],
  );

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

      <Card className="p-4">
        <div className="min-h-24 text-lg text-muted-foreground">告诉我你想安排什么...</div>
        <div className="flex justify-end">
          <button
            type="button"
            className="grid size-12 place-items-center rounded-2xl bg-life-ai text-background"
            onClick={() => void handleQuickAction('生成今日建议')}
          >
            <Send className="size-5" />
          </button>
        </div>
      </Card>

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
                className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:bg-secondary disabled:cursor-default disabled:opacity-70"
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
                className="flex w-full items-center gap-4 rounded-[1.25rem] border border-border bg-card p-4 text-left transition hover:bg-secondary"
                onClick={() =>
                  void handleQuickAction(
                    prompt.type === '计划'
                      ? '创建计划'
                      : prompt.type === '回顾'
                        ? '每周回顾'
                        : '分析图片',
                  )
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
