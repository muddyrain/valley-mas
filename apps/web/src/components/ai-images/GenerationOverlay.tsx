import { CirclePause } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AIImageGeneration, AIImageGenerationStage } from '@/api/aiImages';
import ThinkingOrbs from '@/components/ThinkingOrbs';
import { Button } from '@/components/ui/button';
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
  const [now, setNow] = useState(() => Date.now());
  const isGenerating = Boolean(generation && isLiveGeneration(generation));
  const stageContent = STAGES[stage];

  useEffect(() => {
    if (!isGenerating) return;
    setNow(Date.now());
    const intervalID = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalID);
  }, [isGenerating]);

  const elapsedMilliseconds = generation ? getGenerationElapsedMilliseconds(generation, now) : null;

  return (
    <ThinkingOrbs
      title={stageContent.title}
      description={
        elapsedMilliseconds !== null
          ? `已耗时 ${formatElapsedTime(elapsedMilliseconds)}`
          : stageContent.description
      }
      compact={compact}
      layout="column"
      className={cn('ai-image-generation-pulse', compact && 'is-compact', className)}
    />
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
  const activeStageIndex = Math.max(0, REAL_STAGES.indexOf(stage as (typeof REAL_STAGES)[number]));
  return (
    <div className="ai-image-generation-overlay">
      <div className="w-[min(34rem,calc(100%-2rem))] px-4 py-5 sm:px-5">
        <GenerationPreview
          stage={stage}
          generation={generation}
          className="min-h-0 border-0 bg-transparent py-5"
        />
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
