import { Sparkles } from 'lucide-react';
import type { AIImageGenerationStage } from '@/api/aiImages';
import { Progress } from '@/components/ui/progress';
import './generation-overlay.css';

const STAGES: Record<
  AIImageGenerationStage,
  { title: string; description: string; progress: number }
> = {
  preparing: {
    title: '正在整理创作内容',
    description: '画布、模板和输出设置正在进入生成任务。',
    progress: 12,
  },
  generating: {
    title: 'AI 正在生成画面',
    description: '模型正在理解构图、主体和视觉风格。',
    progress: 58,
  },
  storing: {
    title: '正在保存生成结果',
    description: '图片已经完成，正在写入私有资源存储。',
    progress: 88,
  },
  completed: {
    title: '生成完成',
    description: '结果已进入创作历史。',
    progress: 100,
  },
};

export function GenerationOverlay({ stage }: { stage: AIImageGenerationStage }) {
  const content = STAGES[stage] ?? STAGES.generating;
  return (
    <div className="ai-image-generation-overlay" role="status" aria-live="polite">
      <div className="ai-image-generation-grain" aria-hidden="true" />
      <div className="ai-image-generation-scan" aria-hidden="true" />
      <div className="relative z-10 w-[min(22rem,calc(100%-2rem))] rounded-xl border border-border bg-card/94 p-4 shadow-lg backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4 animate-pulse motion-reduce:animate-none" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{content.title}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{content.description}</p>
          </div>
        </div>
        <Progress value={content.progress} className="mt-4" aria-label="图片生成进度" />
      </div>
    </div>
  );
}
