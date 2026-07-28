import { AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ValidationError } from './validateWorkflowConfig';

interface WorkflowValidationPanelProps {
  errors: readonly ValidationError[];
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

export function WorkflowValidationPanel({
  errors,
  onSelect,
  onClose,
}: WorkflowValidationPanelProps) {
  return (
    <section aria-label="错误列表" className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">错误列表</h2>
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
            {errors.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="关闭错误列表"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3">
        <div className="space-y-2">
          {errors.map((error, index) => {
            const canFocus = error.nodeId !== 'workflow';
            return (
              <button
                key={`${error.nodeId}-${error.field || error.message}-${index}`}
                type="button"
                disabled={!canFocus}
                onClick={() => canFocus && onSelect(error.nodeId)}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-left transition-colors hover:border-destructive/35 hover:bg-destructive/5 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-default disabled:opacity-80"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {error.nodeLabel}
                  </span>
                  <span className="mt-0.5 block text-xs text-destructive">{error.message}</span>
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </section>
  );
}
