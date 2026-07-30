import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type WorkflowIOFieldLayout = 'default' | 'compact' | 'editor';

interface WorkflowIOFieldProps {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  description?: string;
  error?: string;
  nameControl?: ReactNode;
  typeControl?: ReactNode;
  accessory?: ReactNode;
  valueControl?: ReactNode;
  actions?: ReactNode;
  layout?: WorkflowIOFieldLayout;
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
  accessory,
  valueControl,
  actions,
  layout = 'default',
  className,
}: WorkflowIOFieldProps) {
  const displayLabel = label && label !== name ? label : undefined;
  const compact = layout === 'compact';
  const editor = layout === 'editor';

  return (
    <div className={cn('space-y-1.5', className)}>
      <div
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          'min-w-0 rounded-xl border border-border bg-card p-3 shadow-xs transition-[background-color,border-color,box-shadow] duration-200',
          editor && 'p-4',
          'hover:border-primary/25 hover:bg-muted/10 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10',
          error && 'border-destructive/70 bg-destructive/5 focus-within:border-destructive/70',
        )}
      >
        <div
          className={cn(
            'min-w-0 items-center gap-2',
            compact
              ? 'grid grid-cols-[minmax(0,1fr)_4.75rem_2rem_auto]'
              : editor
                ? 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-2'
                : 'flex',
          )}
        >
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {nameControl || (
                <span
                  className={cn(
                    'truncate text-sm font-medium text-foreground',
                    !editor && 'font-mono',
                    editor && 'font-semibold',
                  )}
                >
                  {editor && displayLabel ? displayLabel : name}
                </span>
              )}
              {editor && displayLabel && !nameControl ? (
                <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                  {name}
                </span>
              ) : null}
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
            {displayLabel && !editor ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{displayLabel}</p>
            ) : null}
          </div>
          {typeControl || type ? (
            <div className={cn('shrink-0', compact && 'w-full')}>
              {typeControl ||
                (type ? (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'font-mono font-normal',
                      compact && 'w-full justify-center',
                      editor && 'border border-border/70 bg-muted/50',
                    )}
                  >
                    {type}
                  </Badge>
                ) : null)}
            </div>
          ) : null}
          {accessory ? <div className="flex shrink-0 justify-center">{accessory}</div> : null}
          {actions ? (
            <div className={cn('flex shrink-0 justify-self-end', editor && 'col-span-2')}>
              {actions}
            </div>
          ) : null}
        </div>
        {valueControl ? (
          <div
            className={cn(
              'mt-3 min-w-0 border-t border-dashed border-border/80 pt-2.5',
              editor ? 'block pt-3' : 'flex items-center',
            )}
          >
            {valueControl}
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
