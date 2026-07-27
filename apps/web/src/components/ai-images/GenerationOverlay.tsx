import gsap from 'gsap';
import { CirclePause, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AIImageGeneration, AIImageGenerationStage } from '@/api/aiImages';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import './generation-overlay.css';

const STAGES: Record<AIImageGenerationStage, { title: string; description: string }> = {
  preparing: {
    title: '正在准备创作内容',
    description: '正在整理构图、模板与输出规格。',
  },
  generating: {
    title: '正在生成画面',
    description: '模型正在处理主体、构图与视觉风格。',
  },
  storing: {
    title: '正在保存结果',
    description: '图片已完成，正在写入创作历史。',
  },
  completed: {
    title: '生成完成',
    description: '结果已进入创作历史。',
  },
};

const REAL_STAGES: Array<Extract<AIImageGenerationStage, 'preparing' | 'generating' | 'storing'>> =
  ['preparing', 'generating', 'storing'];

const FIELD_DOTS = Array.from({ length: 121 }, (_, index) => {
  const column = index % 11;
  const row = Math.floor(index / 11);
  const distance = Math.hypot(column - 5, row - 5) / 7.1;
  const density = Math.max(0, 1 - distance);
  return {
    id: `${column}-${row}`,
    x: 14 + column * 7.2,
    y: 14 + row * 7.2,
    radius: 0.38 + density * 1.58,
    opacity: 0.08 + density * 0.56,
  };
});

type GenerationTiming = Pick<
  AIImageGeneration,
  'status' | 'createdAt' | 'startedAt' | 'finishedAt' | 'updatedAt'
>;

const isLiveGeneration = (generation: GenerationTiming) =>
  generation.status === 'queued' || generation.status === 'running';

const getGenerationElapsedMilliseconds = (generation: GenerationTiming, now: number) => {
  const startedAt = Date.parse(generation.startedAt || generation.createdAt);
  if (!Number.isFinite(startedAt)) return null;

  const finishedAt = isLiveGeneration(generation)
    ? now
    : Date.parse(generation.finishedAt || generation.updatedAt || generation.createdAt);
  if (!Number.isFinite(finishedAt)) return null;

  return Math.max(0, finishedAt - startedAt);
};

const formatElapsedTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export function GenerationPreview({
  stage = 'generating',
  compact = false,
  className,
  generation,
}: {
  stage?: AIImageGenerationStage;
  compact?: boolean;
  className?: string;
  generation?: GenerationTiming;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const isGenerating = Boolean(generation && isLiveGeneration(generation));

  useEffect(() => {
    if (!isGenerating) return;
    setNow(Date.now());
    const intervalID = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalID);
  }, [isGenerating]);

  const elapsedMilliseconds = generation ? getGenerationElapsedMilliseconds(generation, now) : null;

  useEffect(() => {
    if (!rootRef.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0, y: 12, scale: 0.98 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.42, ease: 'power3.out' },
      );
      const field = rootRef.current?.querySelector('[data-generation-field]');
      const dots = rootRef.current?.querySelectorAll('[data-generation-dot]');
      if (!field || !dots?.length) return;
      gsap.fromTo(
        field,
        { autoAlpha: 0, scale: 0.96 },
        { autoAlpha: 1, scale: 1, duration: 0.56, ease: 'power3.out' },
      );
      gsap.set(dots, { transformOrigin: '50% 50%' });
      const timeline = gsap.timeline({ repeat: -1, repeatDelay: 0.15 });
      timeline
        .to(dots, {
          autoAlpha: (index) => 0.2 + ((index % 11) / 11) * 0.22,
          scale: (index) => 0.72 + ((index % 11) / 11) * 0.62,
          duration: 1.45,
          ease: 'sine.inOut',
          stagger: { each: 0.014, grid: [11, 11], from: 'center' },
        })
        .to(dots, {
          autoAlpha: (index) => 0.1 + ((10 - (index % 11)) / 11) * 0.18,
          scale: (index) => 0.58 + ((10 - (index % 11)) / 11) * 0.5,
          duration: 1.35,
          ease: 'sine.inOut',
          stagger: { each: 0.012, grid: [11, 11], from: 'edges' },
        });
    }, rootRef);
    return () => context.revert();
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn('ai-image-generation-pulse', compact && 'is-compact', className)}
      data-stage={stage}
      role="status"
      aria-label="图片生成中"
    >
      <svg
        data-generation-field
        className="ai-image-generation-field"
        viewBox="0 0 100 100"
        aria-hidden="true"
      >
        {FIELD_DOTS.map((dot) => (
          <circle
            key={dot.id}
            data-generation-dot
            className="ai-image-generation-dot"
            cx={dot.x}
            cy={dot.y}
            r={dot.radius}
            opacity={dot.opacity}
          />
        ))}
      </svg>
      <div className="ai-image-generation-meta">
        <span className="ai-image-generation-caption">正在生成</span>
        {elapsedMilliseconds !== null ? (
          <span className="ai-image-generation-elapsed">
            已耗时 {formatElapsedTime(elapsedMilliseconds)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function GenerationOverlay({
  stage,
  onPause,
  pausing = false,
  generation,
}: {
  stage: AIImageGenerationStage;
  onPause?: () => void;
  pausing?: boolean;
  generation?: GenerationTiming;
}) {
  const content = STAGES[stage] ?? STAGES.generating;
  const activeStageIndex = Math.max(0, REAL_STAGES.indexOf(stage as (typeof REAL_STAGES)[number]));
  return (
    <div className="ai-image-generation-overlay" role="status" aria-live="polite">
      <div className="w-[min(34rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-4 shadow-lg sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-primary">
            <Sparkles className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-foreground">{content.title}</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{content.description}</p>
          </div>
        </div>
        <div className="ai-image-generation-skeleton mt-4" aria-hidden="true">
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          <GenerationPreview
            stage={stage}
            generation={generation}
            className="ai-image-generation-skeleton-preview"
          />
          <Skeleton className="absolute top-[14%] left-[10%] h-[18%] w-[42%] bg-background/70" />
          <Skeleton className="absolute right-[10%] bottom-[14%] h-[46%] w-[30%] bg-background/70" />
          <Skeleton className="absolute bottom-[14%] left-[10%] h-[22%] w-[34%] bg-background/60" />
        </div>
        <ol className="ai-image-generation-stages mt-4" aria-label="图片生成阶段">
          {REAL_STAGES.map((item, index) => {
            const isActive = index === activeStageIndex;
            const isComplete = index < activeStageIndex || stage === 'completed';
            return (
              <li
                key={item}
                className={cn(isActive && 'is-active', isComplete && 'is-complete')}
                aria-current={isActive ? 'step' : undefined}
              >
                <span aria-hidden="true" />
                {STAGES[item].title}
              </li>
            );
          })}
        </ol>
        {onPause ? (
          <div className="mt-4 flex justify-end">
            <Button type="button" size="sm" variant="outline" onClick={onPause} disabled={pausing}>
              <CirclePause />
              暂停生成
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
