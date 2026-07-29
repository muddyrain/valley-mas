import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WorkflowFieldTagProps {
  label: ReactNode;
  error?: string;
  className?: string;
  wrapperClassName?: string;
}

/** Shared compact field tag used by workflow nodes and their output preview. */
export function WorkflowFieldTag({
  label,
  error,
  className,
  wrapperClassName,
}: WorkflowFieldTagProps) {
  const tag = (
    <span
      className={cn(
        'inline-flex h-6 max-w-full items-center justify-start gap-1 rounded-md border border-border/55 bg-muted/55 px-2 font-mono text-[10px] font-medium leading-none text-foreground transition-colors duration-150',
        error && 'border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-300',
        className,
      )}
    >
      <span className="inline-flex h-full min-w-0 -translate-y-px items-center truncate text-left leading-none">
        {label}
      </span>
      <AlertCircle
        className={cn('size-3 shrink-0', error ? 'visible' : 'invisible')}
        aria-hidden={!error}
      />
    </span>
  );

  if (!error) {
    return <span className={cn('inline-block align-middle', wrapperClassName)}>{tag}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className={cn('inline-block align-middle', wrapperClassName)} />}
      >
        {tag}
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-xs">
        {error}
      </TooltipContent>
    </Tooltip>
  );
}
