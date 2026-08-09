import ThinkingOrbs from '@/components/ThinkingOrbs';
import { cn } from '@/lib/utils';

interface MediaLoadingOverlayProps {
  show: boolean;
  className?: string;
}

export default function MediaLoadingOverlay({ show, className }: MediaLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex items-center justify-center',
        className,
      )}
    >
      <ThinkingOrbs title="图片加载中" compact hideText />
    </div>
  );
}
