import { CircleCheck } from 'lucide-react';
import type { Ref } from 'react';
import { cn } from '@/lib/utils';

interface BlogCoverPreviewProps {
  src: string;
  previousSrc?: string;
  revealCurrent?: boolean;
  showRecoveryNotice?: boolean;
  visibilityLabel: string;
  viewportRef?: Ref<HTMLDivElement>;
}

export function BlogCoverPreview({
  src,
  previousSrc = '',
  revealCurrent = true,
  showRecoveryNotice = false,
  visibilityLabel,
  viewportRef,
}: BlogCoverPreviewProps) {
  const isTransitioning = Boolean(previousSrc);

  return (
    <div
      data-slot="blog-cover-preview"
      className="mt-3 overflow-hidden rounded-xl border border-border/50 bg-muted"
    >
      <div ref={viewportRef} className="relative aspect-video w-full overflow-hidden">
        <img
          src={src}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-3xl"
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,hsl(var(--background)_/_0.34),hsl(var(--background)_/_0.06)_48%,transparent_78%)]" />

        {previousSrc ? (
          <img
            src={previousSrc}
            alt=""
            aria-hidden
            data-slot="blog-cover-previous-image"
            className={cn(
              'pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-opacity duration-500 ease-out motion-reduce:transition-none',
              revealCurrent ? 'opacity-0' : 'opacity-100',
            )}
          />
        ) : null}

        <img
          src={src}
          alt="博客封面预览"
          data-slot="blog-cover-current-image"
          className={cn(
            'pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none',
            isTransitioning && !revealCurrent ? 'scale-[1.01] opacity-0' : 'scale-100 opacity-100',
          )}
          draggable={false}
        />

        <div
          role={showRecoveryNotice ? 'status' : undefined}
          aria-live={showRecoveryNotice ? 'polite' : undefined}
          aria-hidden={!showRecoveryNotice}
          data-slot="cover-recovery-notice"
          className={cn(
            'absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/95 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
            showRecoveryNotice
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-1 opacity-0',
          )}
        >
          <CircleCheck className="size-3.5 text-primary" strokeWidth={2} aria-hidden />
          <span>已恢复上次生成的封面</span>
        </div>
      </div>

      <div className="px-3 py-1 text-xs text-muted-foreground">当前可见范围：{visibilityLabel}</div>
    </div>
  );
}
