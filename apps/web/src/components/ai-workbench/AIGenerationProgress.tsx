import ThinkingOrbs from '@/components/ThinkingOrbs';
import { cn } from '@/lib/utils';

export function AIGenerationProgress({
  title = 'AI 正在生成',
  description = '正在理解需求并整理内容，完成后会显示可编辑结果。',
  compact = false,
  className,
}: {
  title?: string;
  description?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <ThinkingOrbs
      title={title}
      description={description}
      compact={compact}
      layout="column"
      className={cn(compact ? 'py-4' : 'py-7', className)}
    />
  );
}
