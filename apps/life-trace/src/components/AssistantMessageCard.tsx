import { AlertCircle, Bot, CheckCircle2, ChevronDown, Loader2, UserRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { LifeAssistantThinkingStep } from '@/api/assistant';

export type AssistantMessageCardMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinkingSteps?: LifeAssistantThinkingStep[];
};

type AssistantMessageCardProps = {
  message: AssistantMessageCardMessage;
  meta?: string;
  streaming?: boolean;
};

type MergedThinkingStep = {
  step: number;
  tool: string;
  label: string;
  status: 'running' | 'ok' | 'error';
  summary?: string;
};

function mergeThinkingSteps(steps: LifeAssistantThinkingStep[]): MergedThinkingStep[] {
  const bucket = new Map<number, MergedThinkingStep>();
  for (const raw of steps) {
    const label = raw.label?.trim() || raw.tool;
    const existing = bucket.get(raw.step);
    if (raw.phase === 'call') {
      bucket.set(raw.step, {
        step: raw.step,
        tool: raw.tool,
        label,
        status: 'running',
      });
      continue;
    }
    bucket.set(raw.step, {
      step: raw.step,
      tool: raw.tool,
      label: existing?.label || label,
      status: raw.ok === false ? 'error' : 'ok',
      summary: raw.summary?.trim() || undefined,
    });
  }
  return Array.from(bucket.values()).sort((left, right) => left.step - right.step);
}

function ThinkingTimeline({ steps }: { steps: LifeAssistantThinkingStep[] }) {
  const [expanded, setExpanded] = useState(false);
  const merged = useMemo(() => mergeThinkingSteps(steps), [steps]);
  if (merged.length === 0) {
    return null;
  }

  const running = merged.some((step) => step.status === 'running');
  const summaryLabel = running
    ? `深度思考中 · ${merged.length} 步`
    : `深度思考 · ${merged.length} 步`;

  return (
    <div className="mt-2 rounded-2xl border border-life-ai/15 bg-life-ai/5">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2 text-left text-xs font-semibold text-life-ai transition hover:bg-life-ai/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-life-ai/40"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="inline-flex items-center gap-2">
          {running ? (
            <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          {summaryLabel}
        </span>
        <ChevronDown
          className={`size-3.5 transition ${expanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {expanded ? (
        <ol className="space-y-2 border-t border-life-ai/15 px-3 py-2 text-xs text-muted-foreground">
          {merged.map((step) => {
            const StatusIcon =
              step.status === 'running'
                ? Loader2
                : step.status === 'error'
                  ? AlertCircle
                  : CheckCircle2;
            const iconTone =
              step.status === 'error'
                ? 'text-life-alert'
                : step.status === 'running'
                  ? 'text-life-ai'
                  : 'text-life-trace';
            return (
              <li key={step.step} className="flex items-start gap-2">
                <StatusIcon
                  className={`mt-0.5 size-3.5 shrink-0 ${iconTone} ${
                    step.status === 'running' ? 'animate-spin motion-reduce:animate-none' : ''
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {step.status === 'running' ? `正在${step.label}` : step.label}
                  </p>
                  {step.summary ? (
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{step.summary}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

export function AssistantMessageCard({
  message,
  meta,
  streaming = false,
}: AssistantMessageCardProps) {
  const isUser = message.role === 'user';
  const Icon = isUser ? UserRound : Bot;
  const thinkingSteps = message.thinkingSteps ?? [];

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex max-w-[86%] items-start gap-3 max-[420px]:max-w-[94%] ${
          isUser ? 'flex-row-reverse' : ''
        }`}
      >
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-full ${
            isUser ? 'bg-life-plan/10 text-life-plan' : 'bg-life-ai/15 text-life-ai'
          }`}
        >
          <Icon className="size-4" />
        </div>
        <div
          className={`min-w-0 rounded-[1.25rem] border px-4 py-3 ${
            isUser
              ? 'rounded-tr-md border-life-plan/20 bg-life-plan/10'
              : 'rounded-tl-md border-life-ai/20 bg-life-ai/5'
          }`}
        >
          <div
            className={`flex items-center gap-3 ${
              isUser ? 'justify-end text-right' : 'justify-between'
            }`}
          >
            <p className="text-xs font-semibold text-muted-foreground">
              {isUser ? '你' : 'Life Trace 生活助理'}
            </p>
            {meta ? <span className="shrink-0 text-xs text-muted-foreground">{meta}</span> : null}
          </div>
          {!isUser && thinkingSteps.length > 0 ? <ThinkingTimeline steps={thinkingSteps} /> : null}
          {streaming && !message.content ? (
            <div className="mt-2 inline-flex items-center gap-2 text-sm leading-6 text-foreground">
              <span>正在整理</span>
              <span className="inline-flex items-center gap-1" aria-hidden="true">
                <span className="size-1.5 animate-pulse rounded-full bg-life-ai motion-reduce:animate-none" />
                <span className="size-1.5 animate-pulse rounded-full bg-life-ai [animation-delay:150ms] motion-reduce:animate-none" />
                <span className="size-1.5 animate-pulse rounded-full bg-life-ai [animation-delay:300ms] motion-reduce:animate-none" />
              </span>
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
              {message.content || '暂无回复'}
              {!isUser && streaming ? (
                <span className="ml-1 inline-block h-4 w-1 animate-pulse rounded-full bg-life-ai align-[-2px] motion-reduce:animate-none" />
              ) : null}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
