import type { PropsWithChildren } from 'react';
import BoxLoadingOverlay from '@/components/BoxLoadingOverlay';
import { cn } from '@/lib/utils';

interface BlockingLoadingSurfaceProps extends PropsWithChildren {
  show: boolean;
  title: string;
  hint?: string;
  className?: string;
  contentClassName?: string;
}

export default function BlockingLoadingSurface({
  show,
  title,
  hint,
  className,
  contentClassName,
  children,
}: BlockingLoadingSurfaceProps) {
  return (
    <div className={cn('relative overflow-hidden', className)} aria-busy={show || undefined}>
      <div
        inert={show || undefined}
        aria-hidden={show || undefined}
        className={cn(
          'transition-opacity duration-200 ease-out motion-reduce:transition-none',
          show && 'pointer-events-none select-none opacity-40',
          contentClassName,
        )}
      >
        {children}
      </div>

      <BoxLoadingOverlay
        show={show}
        title={title}
        hint={hint}
        className="pointer-events-auto cursor-wait items-start bg-background/75 px-4 pt-20 md:pt-24"
        contentClassName="w-full max-w-72 rounded-xl border border-border/70 bg-card px-5 py-4 shadow-lg shadow-foreground/5"
      />
    </div>
  );
}
