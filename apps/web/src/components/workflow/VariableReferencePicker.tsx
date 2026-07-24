import { Braces } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  getWorkflowVariableOption,
  type WorkflowVariableOption,
  workflowValueTypeLabel,
} from './workflowVariables';

const CLEAR_VALUE = '__clear_workflow_variable__';

interface VariableReferencePickerProps {
  value: string;
  onChange: (value: string) => void;
  options: WorkflowVariableOption[];
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  showType?: boolean;
  leading?: ReactNode;
  emptyText?: string;
}

// A reference is a single typed value, not a text template. Keep it separate
// from VariableTokenEditor, which is intentionally used by prompt text fields.
export function VariableReferencePicker({
  value,
  onChange,
  options,
  placeholder = '选择变量',
  ariaLabel,
  className,
  showType = true,
  leading,
  emptyText = '暂无可用变量',
}: VariableReferencePickerProps) {
  const selected = getWorkflowVariableOption(value, options);

  return (
    <Select
      // Keep the select controlled when clearing; `undefined` switches Base UI
      // back to uncontrolled mode and leaves the previous item rendered.
      value={selected?.token ?? null}
      onValueChange={(nextValue) => onChange(nextValue === CLEAR_VALUE ? '' : nextValue || '')}
    >
      <SelectTrigger aria-label={ariaLabel} className={cn('min-w-0', className)}>
        {selected ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {leading}
            {showType ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                {workflowValueTypeLabel(selected.type)}
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex min-w-0" />}>
                <span className="inline-flex min-w-0 items-center gap-1 rounded-sm border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-primary">
                  <Braces className="size-3 shrink-0" />
                  <span className="truncate">
                    来源：{selected.nodeLabel} · {selected.field}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-80">
                来源节点：{selected.nodeLabel}；变量：{selected.field}；类型：
                {workflowValueTypeLabel(selected.type)}
              </TooltipContent>
            </Tooltip>
          </span>
        ) : leading ? (
          <span className="flex min-w-0 items-center gap-1.5">
            {leading}
            <SelectValue placeholder={placeholder} />
          </span>
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} className="min-w-0">
        {selected ? (
          <SelectItem value={CLEAR_VALUE} className="text-muted-foreground">
            清除选择
          </SelectItem>
        ) : null}
        {options.length === 0 ? (
          <SelectItem value="__workflow_variable_option_empty__" disabled className="h-auto py-3">
            <span className="whitespace-normal text-xs leading-relaxed text-muted-foreground">
              {emptyText}
            </span>
          </SelectItem>
        ) : (
          options.map((option) => (
            <SelectItem key={option.token} value={option.token} className="h-auto py-2">
              <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
                <span className="max-w-full truncate text-sm font-medium text-foreground">
                  变量：{option.field}
                </span>
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  来源节点：{option.nodeLabel} · 类型：{workflowValueTypeLabel(option.type)}
                </span>
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

interface VariableValueEditorProps {
  value: string;
  onChange: (value: string, selected?: WorkflowVariableOption) => void;
  options: WorkflowVariableOption[];
  ariaLabel?: string;
  fixedPlaceholder?: string;
  className?: string;
  defaultMode?: 'reference' | 'fixed';
  referenceEmptyText?: string;
}

// Input and output mappings deliberately choose either one reference or one
// literal. The two modes must not be mixed in a single value.
export function VariableValueEditor({
  value,
  onChange,
  options,
  ariaLabel,
  fixedPlaceholder = '输入固定值',
  className,
  defaultMode = 'reference',
  referenceEmptyText,
}: VariableValueEditorProps) {
  const hasReference = options.some((option) => option.token === value);
  const [mode, setMode] = useState<'reference' | 'fixed'>(
    hasReference ? 'reference' : value ? 'fixed' : defaultMode,
  );

  useEffect(() => {
    if (hasReference) setMode('reference');
    else if (value) setMode('fixed');
  }, [hasReference, value]);

  return (
    <div className={cn('flex gap-2', className)}>
      <Select
        value={mode}
        onValueChange={(nextMode) => {
          setMode(nextMode as 'reference' | 'fixed');
          onChange('');
        }}
      >
        <SelectTrigger aria-label={`${ariaLabel || '变量值'}来源`} className="w-28 shrink-0">
          {mode === 'reference' ? '引用变量' : '固定值'}
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false} className="min-w-28">
          <SelectItem value="reference">引用变量</SelectItem>
          <SelectItem value="fixed">固定值</SelectItem>
        </SelectContent>
      </Select>
      {mode === 'reference' ? (
        <VariableReferencePicker
          ariaLabel={ariaLabel}
          className="min-w-0 flex-1"
          value={value}
          onChange={(nextValue) =>
            onChange(
              nextValue,
              options.find((option) => option.token === nextValue),
            )
          }
          options={options}
          placeholder="选择上游变量"
          emptyText={referenceEmptyText}
        />
      ) : (
        <Input
          aria-label={ariaLabel}
          className="min-w-0 flex-1"
          value={value}
          placeholder={fixedPlaceholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
