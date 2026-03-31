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
        'relative h-full w-full overflow-hidden bg-[linear-gradient(135deg,#eef2ff_0%,#e0f2fe_42%,#f8fafc_100%)]',
        className,
      )}
    >
      <div
        className={cn(
          'absolute rounded-full bg-violet-300/45 blur-2xl',
          compact ? '-left-8 -top-8 h-28 w-28' : '-left-18 -top-16 h-52 w-52 blur-3xl',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full bg-sky-300/45 blur-2xl',
          compact ? '-bottom-8 -right-8 h-28 w-28' : '-bottom-18 -right-10 h-56 w-56 blur-3xl',
        )}
      />
      <div
        className={cn(
          'absolute rounded-full bg-cyan-200/35',
          compact ? 'left-1/3 top-1/3 h-16 w-16 blur-xl' : 'left-1/3 top-1/3 h-28 w-28 blur-2xl',
        )}
      />
      <div
        className={cn(
          'absolute inset-0 bg-[linear-gradient(rgba(124,58,237,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.25)_1px,transparent_1px)]',
          compact ? 'opacity-[0.18] bg-size-[20px_20px]' : 'opacity-[0.16] bg-size-[24px_24px]',
        )}
      />
      <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.95),transparent_36%),radial-gradient(circle_at_10%_80%,rgba(255,255,255,0.8),transparent_28%)]" />
      {!compact && (
        <>
          <div className="absolute -left-8 top-8 h-30 w-80 -rotate-12 bg-white/25 blur-xl" />
          <div className="absolute right-0 top-0 h-full w-28 bg-linear-to-l from-white/45 to-transparent" />
          <div className="absolute left-8 top-8 h-2.5 w-2.5 rounded-full bg-violet-500/45" />
          <div className="absolute right-12 top-12 h-2 w-2 rounded-full bg-sky-500/45" />
          <div className="absolute bottom-10 left-14 h-2 w-2 rounded-full bg-cyan-500/45" />
        </>
      )}
      {children}
    </div>
  );
}
