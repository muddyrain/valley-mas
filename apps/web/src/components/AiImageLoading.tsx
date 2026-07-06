import { Sparkles } from 'lucide-react';
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
    <div
      className={cn(
        'border-border bg-accent/50 relative mt-3 overflow-hidden rounded-xl border p-3',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-card/20 via-transparent to-card/20 animate-pulse" />
      <div className="relative flex items-center gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/80">
          <div className="absolute inset-0 animate-ping rounded-xl bg-accent" />
          <Sparkles className="text-primary relative h-5 w-5" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((item) => (
          <span
            key={`ai-image-loading-${item}`}
            className="bg-accent h-1.5 rounded-full animate-pulse"
            style={{ animationDelay: `${item * 180}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
