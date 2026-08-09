import { cn } from '@/lib/utils';
import './ThinkingOrbs.css';

interface ThinkingOrbsProps {
  title?: string;
  description?: string;
  compact?: boolean;
  hideText?: boolean;
  layout?: 'row' | 'column';
  tone?: 'default' | 'inverse';
  className?: string;
}

export default function ThinkingOrbs({
  title,
  description,
  compact = false,
  hideText = false,
  layout = 'row',
  tone = 'default',
  className,
}: ThinkingOrbsProps) {
  const inverse = tone === 'inverse';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={title}
      data-slot="thinking-orbs"
      className={cn(
        'flex min-w-0 items-center',
        layout === 'column'
          ? compact
            ? 'flex-col gap-2 text-center'
            : 'flex-col gap-3 text-center'
          : compact
            ? 'gap-2.5'
            : 'gap-3.5',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex shrink-0 items-center justify-center text-primary',
          compact ? 'h-5 gap-1' : 'h-6 gap-1.5',
          inverse && 'text-white',
        )}
      >
        {[0, 1, 2].map((index) => (
          <span
            key={`thinking-orb-${index}`}
            data-slot="thinking-orb"
            className={cn(
              'thinking-orb rounded-full bg-current motion-reduce:animate-none',
              compact ? 'size-1.5' : 'size-2',
            )}
            style={{ animationDelay: `${index * 140}ms` }}
          />
        ))}
      </span>

      {!hideText && (title || description) ? (
        <span className="min-w-0">
          {title ? (
            <span
              className={cn(
                'block font-medium text-foreground text-pretty',
                compact ? 'text-xs' : 'text-sm',
                inverse && 'text-white',
              )}
            >
              {title}
            </span>
          ) : null}
          {description ? (
            <span
              className={cn(
                'mt-1 block text-xs leading-5 text-muted-foreground text-pretty',
                inverse && 'text-white/75',
              )}
            >
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
