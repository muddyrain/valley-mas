import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoxLoadingOverlayProps {
  show: boolean;
  title?: string;
  hint?: string;
  tone?: 'light' | 'dark';
  compact?: boolean;
  className?: string;
}

export default function BoxLoadingOverlay({
  show,
  title = 'Loading content...',
  hint = 'Please wait a moment.',
  tone = 'light',
  compact = false,
  className,
}: BoxLoadingOverlayProps) {
  if (!show) return null;

  const isDark = tone === 'dark';

  return (
    <div
      aria-live="polite"
      className={cn(
        'absolute inset-0 z-20 flex items-center justify-center rounded-[inherit] backdrop-blur-xl',
        isDark
          ? 'bg-[radial-gradient(circle_at_18%_20%,hsl(var(--primary)/0.1),transparent_50%),radial-gradient(circle_at_82%_24%,hsl(var(--primary)/0.12),transparent_45%),linear-gradient(180deg,hsl(var(--foreground)/0.2),hsl(var(--foreground)/0.3))]'
          : 'bg-[radial-gradient(circle_at_14%_18%,hsl(var(--primary)/0.08),transparent_45%),radial-gradient(circle_at_84%_22%,hsl(var(--primary)/0.06),transparent_40%),linear-gradient(180deg,hsl(var(--foreground)/0.12),hsl(var(--foreground)/0.18))]',
        className,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden text-center',
          compact ? 'rounded-xl px-4 py-3' : 'rounded-2xl px-7 py-5',
          isDark
            ? 'border border-foreground/25 bg-card/70 shadow-[0_18px_44px_hsl(var(--foreground)/0.55)]'
            : 'border border-border bg-card/86 shadow-[0_20px_48px_hsl(var(--foreground)/0.10)]',
        )}
      >
        <div className="pointer-events-none absolute -left-8 -top-8 h-24 w-24 rounded-full bg-accent blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full bg-accent/80 blur-2xl" />

        <div className={cn('relative mx-auto', compact ? 'mb-2 h-9 w-9' : 'mb-3 h-12 w-12')}>
          <div
            className={cn(
              'absolute inset-0 rounded-full border-2',
              isDark ? 'border-foreground/30' : 'border-accent',
            )}
          />
          <div
            className={cn(
              'absolute inset-0 animate-spin rounded-full border-2 border-transparent',
              isDark
                ? 'border-t-foreground border-r-foreground/60'
                : 'border-t-primary border-r-primary/70',
            )}
          />
          <div
            className={cn(
              'absolute inset-2 flex items-center justify-center rounded-full',
              isDark ? 'bg-foreground/20' : 'bg-accent/75',
            )}
          >
            <Sparkles
              className={cn(
                'animate-pulse',
                compact ? 'h-3 w-3' : 'h-4 w-4',
                isDark ? 'text-foreground' : 'text-primary',
              )}
            />
          </div>
        </div>

        <div
          className={cn(
            'relative font-semibold',
            compact ? 'text-xs' : 'text-sm',
            isDark ? 'text-foreground' : 'text-foreground',
          )}
        >
          {title}
        </div>
        {!compact && (
          <div
            className={cn(
              'relative mt-1 text-xs',
              isDark ? 'text-foreground/75' : 'text-muted-foreground',
            )}
          >
            {hint}
          </div>
        )}
      </div>
    </div>
  );
}
