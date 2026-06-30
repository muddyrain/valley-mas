import { LoaderCircle, Sparkle } from 'lucide-react';
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
        'action-loading-icon relative inline-grid size-4 shrink-0 place-items-center align-middle leading-none',
        toneClasses[tone],
        className,
      )}
    >
      <LoaderCircle className="h-full w-full animate-spin motion-reduce:animate-none" />
      <Sparkle className="absolute top-1/2 left-1/2 h-[62.5%] w-[62.5%] -translate-x-1/2 -translate-y-1/2 animate-pulse motion-reduce:animate-none" />
    </span>
  );
}
