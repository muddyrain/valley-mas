import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface WorkflowIOFieldProps {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  description?: string;
  error?: string;
  nameControl?: ReactNode;
  typeControl?: ReactNode;
  valueControl?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Shared visual and validation boundary for workflow input/output fields.
 * Callers decide whether the field contract is editable; this component keeps
 * fixed tool contracts and editable general-node contracts visually identical.
 */
export function WorkflowIOField({
  name,
  label,
  type,
  required = false,
  description,
  error,
  nameControl,
  typeControl,
  valueControl,
  actions,
  className,
}: WorkflowIOFieldProps) {
  const displayLabel = label && label !== name ? label : undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          'min-w-0 rounded-lg border border-border bg-card p-2.5 transition-colors',
          'hover:border-primary/25 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10',
          error && 'border-destructive/70 bg-destructive/5 focus-within:border-destructive/70',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {nameControl || (
                <span className="truncate font-mono text-sm font-medium text-foreground">
                  {name}
                </span>
              )}
              {required ? <span className="shrink-0 text-destructive">*</span> : null}
              {description ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                        aria-label={`${displayLabel || name}说明`}
                      />
                    }
                  >
                    <Info className="size-3.5" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-64 leading-relaxed">
                    {description}
                  </TooltipContent>
                </Tooltip>
              ) : null}
            </div>
            {displayLabel ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayLabel}</p>
            ) : null}
          </div>
          {typeControl ||
            (type ? (
              <Badge variant="secondary" className="shrink-0 font-mono font-normal">
                {type}
              </Badge>
            ) : null)}
          {actions}
        </div>
        {valueControl ? <div className="mt-2 min-w-0">{valueControl}</div> : null}
      </div>
      {error ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
