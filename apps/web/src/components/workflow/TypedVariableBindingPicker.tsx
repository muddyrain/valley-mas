import type { WorkflowValueType } from './types';
import { VariableReferencePicker } from './VariableReferencePicker';
import { type WorkflowVariableOption, workflowValueTypeLabel } from './workflowVariables';

interface TypedVariableBindingPickerProps {
  type: WorkflowValueType;
  value: unknown;
  onChange: (value: string) => void;
  options: WorkflowVariableOption[];
  ariaLabel?: string;
  className?: string;
  placeholder?: string;
  showType?: boolean;
}

// Bind a typed field to one compatible upstream variable. Literal values live
// in the Variable node, so every tool and workflow mapping keeps data lineage visible.
export function TypedVariableBindingPicker({
  type,
  value,
  onChange,
  options,
  ariaLabel,
  className,
  placeholder = '选择上游变量',
  showType = true,
}: TypedVariableBindingPickerProps) {
  const compatibleOptions = options.filter((option) => option.type === type);
  const stringValue = typeof value === 'string' ? value : '';
  const isLegacyFixedValue =
    value !== undefined &&
    value !== '' &&
    !compatibleOptions.some((option) => option.token === stringValue);

  return (
    <div className="space-y-1.5">
      <VariableReferencePicker
        ariaLabel={ariaLabel}
        className={`${className || ''} w-full min-w-0 border-border bg-muted/20 hover:bg-muted/35`}
        value={isLegacyFixedValue ? '' : stringValue}
        onChange={onChange}
        options={compatibleOptions}
        placeholder={placeholder}
        showType={false}
        emptyText={`暂无可引用的${workflowValueTypeLabel(type)}变量`}
        leading={
          showType ? (
            <span className="shrink-0 rounded-sm bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              {workflowValueTypeLabel(type)}
            </span>
          ) : undefined
        }
      />
      {isLegacyFixedValue ? (
        <p className="text-xs text-muted-foreground">
          此字段保留了历史固定值；请创建同类型变量后重新选择。
        </p>
      ) : null}
    </div>
  );
}
