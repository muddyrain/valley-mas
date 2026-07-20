import type { WorkflowValueType } from './types';
import { VariableReferencePicker, VariableValueEditor } from './VariableReferencePicker';
import type { WorkflowVariableOption } from './workflowVariables';

const workflowValueTypes = new Set<WorkflowValueType>([
  'string',
  'string[]',
  'object',
  'number',
  'boolean',
  'file',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function toWorkflowValueType(type: string | undefined): WorkflowValueType {
  return type && workflowValueTypes.has(type as WorkflowValueType)
    ? (type as WorkflowValueType)
    : 'string';
}

export function formatTypedVariableValue(value: unknown, type: WorkflowValueType) {
  if (type === 'string[]' && Array.isArray(value)) return JSON.stringify(value);
  if (type === 'object' && isRecord(value)) return JSON.stringify(value);
  return String(value ?? '');
}

export function parseTypedVariableValue(value: string, type: WorkflowValueType): unknown {
  const trimmed = value.trim();
  if (type === 'string[]') {
    if (!trimmed) return [];
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')
        ? parsed
        : value;
    } catch {
      return value;
    }
  }
  if (type === 'object') {
    if (!trimmed) return value;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      return isRecord(parsed) ? parsed : value;
    } catch {
      return value;
    }
  }
  if (type === 'number') {
    if (!trimmed) return value;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : value;
  }
  if (type === 'boolean') {
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
  }
  return value;
}

export function normalizeTypedVariableValue(value: unknown, type: WorkflowValueType) {
  return typeof value === 'string' ? parseTypedVariableValue(value, type) : value;
}

function fixedValuePlaceholder(type: WorkflowValueType, fallback: string) {
  if (type === 'string[]') return '例如：["AI", "工作流"]';
  if (type === 'object') return '输入 JSON 对象';
  if (type === 'number') return '例如：5';
  if (type === 'boolean') return 'true 或 false';
  return fallback;
}

interface TypedVariableValueEditorProps {
  type: WorkflowValueType;
  value: unknown;
  onChange: (value: unknown) => void;
  options: WorkflowVariableOption[];
  ariaLabel?: string;
  fixedPlaceholder?: string;
  className?: string;
  defaultMode?: 'reference' | 'fixed';
}

// A value binding is always constrained by its declared type. Callers own the
// field name and type definition; this component owns source selection and
// literal serialization so every typed field behaves consistently.
export function TypedVariableValueEditor({
  type,
  value,
  onChange,
  options,
  ariaLabel,
  fixedPlaceholder = '输入固定值',
  className,
  defaultMode = 'reference',
}: TypedVariableValueEditorProps) {
  const compatibleOptions = options.filter((option) => option.type === type);
  if (type === 'file') {
    return (
      <VariableReferencePicker
        ariaLabel={ariaLabel}
        className={className}
        value={String(value ?? '')}
        onChange={onChange}
        options={compatibleOptions}
        placeholder="选择上游文件变量"
      />
    );
  }
  return (
    <VariableValueEditor
      ariaLabel={ariaLabel}
      className={className}
      value={formatTypedVariableValue(value, type)}
      onChange={(nextValue) => onChange(parseTypedVariableValue(nextValue, type))}
      options={compatibleOptions}
      fixedPlaceholder={fixedValuePlaceholder(type, fixedPlaceholder)}
      defaultMode={defaultMode}
    />
  );
}
