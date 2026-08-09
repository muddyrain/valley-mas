import ThinkingOrbs from '@/components/ThinkingOrbs';
import { cn } from '@/lib/utils';

interface BoxLoadingOverlayProps {
  show: boolean;
  title?: string;
  hint?: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
  contentClassName?: string;
}

export default function BoxLoadingOverlay({
  show,
  title = 'Loading content...',
  hint = 'Please wait a moment.',
  tone = 'light',
  compact = false,
  className,
  contentClassName,
}: BoxLoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-[inherit]',
        className,
      )}
    >
      <ThinkingOrbs
        title={title}
        description={compact ? undefined : hint}
        compact={compact}
        layout="column"
        tone={tone === 'dark' ? 'inverse' : 'default'}
        className={contentClassName}
      />
    </div>
  );
}
