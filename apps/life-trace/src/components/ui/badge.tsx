import type * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'default' | 'weather' | 'ai' | 'plan' | 'trace' | 'health' | 'alert';

const toneClasses: Record<BadgeTone, string> = {
  default: 'bg-secondary text-secondary-foreground',
  weather: 'bg-life-weather/15 text-life-weather',
  ai: 'bg-life-ai/15 text-life-ai',
  plan: 'bg-life-plan/15 text-life-plan',
  trace: 'bg-life-trace/15 text-life-trace',
  health: 'bg-life-health/15 text-life-health',
  alert: 'bg-life-alert/15 text-life-alert',
};

export function Badge({
  className,
  tone = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tone?: BadgeTone }) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
