import { LoaderCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

type ActionLoadingIconProps = {
  className?: string;
  tone?: 'ai' | 'trace' | 'health' | 'alert' | 'plan';
};

const toneClasses: Record<NonNullable<ActionLoadingIconProps['tone']>, string> = {
  ai: 'text-life-ai',
  trace: 'text-life-trace',
  health: 'text-life-health',
  alert: 'text-life-alert',
  plan: 'text-life-plan',
};

export function ActionLoadingIcon({ className, tone = 'ai' }: ActionLoadingIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'action-loading-icon relative inline-grid size-4 place-items-center',
        toneClasses[tone],
        className,
      )}
    >
      <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
      <Sparkles className="absolute inset-0 m-auto size-2.5 animate-pulse motion-reduce:animate-none" />
    </span>
  );
}
