import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { TypedVariableBindingPicker } from './TypedVariableBindingPicker';
import type { WorkflowValueType } from './types';
import type { WorkflowVariableOption } from './workflowVariables';

interface WorkflowVariableBindingFieldProps {
  label: string;
  type: WorkflowValueType;
  value: unknown;
  onChange: (value: string) => void;
  options: WorkflowVariableOption[];
  description?: string;
  required?: boolean;
  error?: string;
  ariaLabel?: string;
}

// Shared binding card for fields whose name and type are defined by the caller.
// The title and picker occupy separate lines so either can use the full panel width.
export function WorkflowVariableBindingField({
  label,
  type,
  value,
  onChange,
  options,
  description,
  required = false,
  error,
  ariaLabel,
}: WorkflowVariableBindingFieldProps) {
  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          'min-w-0 rounded-lg border border-border bg-card p-2.5 transition-colors hover:border-primary/25 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10',
          error && 'border-destructive/70 bg-destructive/5 focus-within:border-destructive/70',
        )}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
          {required ? <span className="text-destructive">*</span> : null}
          {description ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
                    aria-label={`${label}说明`}
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
        <div className="mt-2 min-w-0">
          <TypedVariableBindingPicker
            ariaLabel={ariaLabel || `${label} 输入值`}
            type={type}
            value={value}
            onChange={onChange}
            options={options}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
