import ThinkingOrbs from '@/components/ThinkingOrbs';
import { cn } from '@/lib/utils';

interface AiImageLoadingProps {
  show: boolean;
  title?: string;
  hint?: string;
  className?: string;
}

export default function AiImageLoading({
  show,
  title = 'AI 正在生成图片...',
  hint = '你可以继续编辑正文，完成后会自动更新预览。',
  className,
}: AiImageLoadingProps) {
  if (!show) return null;

  return (
    <ThinkingOrbs title={title} description={hint} className={cn('mt-3 px-1 py-2', className)} />
  );
}
