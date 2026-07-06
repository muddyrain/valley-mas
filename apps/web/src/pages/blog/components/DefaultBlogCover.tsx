import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DefaultBlogCoverProps {
  className?: string;
  compact?: boolean;
  children?: ReactNode;
}

export function DefaultBlogCover({ className, compact = false, children }: DefaultBlogCoverProps) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden bg-gradient-to-br from-accent/30 via-background to-muted/30',
        className,
      )}
    >
      <div
        className={cn(
          'absolute rounded-full bg-primary/30 blur-2xl',
          compact ? '-left-8 -top-8 h-28 w-28' : '-left-18 -top-16 h-52 w-52 blur-3xl',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full bg-accent/35 blur-2xl',
          compact ? '-bottom-8 -right-8 h-28 w-28' : '-bottom-18 -right-10 h-56 w-56 blur-3xl',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full bg-muted/30',
          compact ? 'left-1/3 top-1/3 h-16 w-16 blur-xl' : 'left-1/3 top-1/3 h-28 w-28 blur-2xl',
        )}
      />
      <div
        className={cn(
          'absolute inset-0 bg-[linear-gradient(hsl(var(--primary)/0.08)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--primary)/0.08)_1px,transparent_1px)]',
          compact ? 'opacity-[0.18] bg-size-[20px_20px]' : 'opacity-[0.16] bg-size-[24px_24px]',
        )}
      />
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_80%_20%,hsl(var(--primary)/0.25),transparent_36%),radial-gradient(circle_at_10%_80%,hsl(var(--primary)/0.18),transparent_28%)]" />
      {!compact && (
        <>
          <div className="absolute -left-8 top-8 h-30 w-80 -rotate-12 bg-primary/15 blur-xl" />
          <div className="absolute right-0 top-0 h-full w-28 bg-gradient-to-l from-primary/25 to-transparent" />
          <div className="absolute left-8 top-8 h-2.5 w-2.5 rounded-full bg-primary/50" />
          <div className="absolute right-12 top-12 h-2 w-2 rounded-full bg-accent/50" />
          <div className="absolute bottom-10 left-14 h-2 w-2 rounded-full bg-muted-foreground/40" />
        </>
      )}
      {children}
    </div>
  );
}
