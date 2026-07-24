import { CircleAlert, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TypedVariableBindingPicker } from '../TypedVariableBindingPicker';
import type { WorkflowValueType } from '../types';
import { VariableReferencePicker } from '../VariableReferencePicker';
import { VariableTokenEditor } from '../VariableTokenEditor';
import {
  getWorkflowBindingTypeMismatchMessage,
  INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE,
} from '../validateWorkflowConfig';
import {
  getInvalidWorkflowVariableTokens,
  type WorkflowVariableOption,
} from '../workflowVariables';
import { RecordKeyInput } from './RecordKeyInput';

const defaultValueTypes: WorkflowValueType[] = [
  'string',
  'string[]',
  'object',
  'number',
  'boolean',
  'file',
];

interface VariableBindingEditorProps {
  values: Record<string, unknown>;
  types: Record<string, WorkflowValueType>;
  variableOptions: WorkflowVariableOption[];
  onChange: (values: Record<string, unknown>, types: Record<string, WorkflowValueType>) => void;
  addLabel: string;
  baseName: string;
  nameAriaLabel: string;
  allowedTypes?: WorkflowValueType[];
  valueMode?: 'inline' | 'explicit' | 'reference';
}

function BindingErrorInfo({ message }: { message: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute -right-2 -top-2 z-10 rounded-full border border-destructive/30 bg-background text-destructive shadow-xs hover:bg-destructive/10 hover:text-destructive"
            aria-label="查看配置错误"
          >
            <CircleAlert />
          </Button>
        }
      />
      <PopoverContent side="bottom" align="start" className="w-80 gap-2">
        <PopoverHeader>
          <PopoverTitle>配置提示</PopoverTitle>
          <PopoverDescription>{message}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

export function VariableBindingEditor({
  values,
  types,
  variableOptions,
  onChange,
  addLabel,
  baseName,
  nameAriaLabel,
  allowedTypes = defaultValueTypes,
  valueMode = 'inline',
}: VariableBindingEditorProps) {
  const names = Object.keys(values);

  return (
    <div className="space-y-3">
      {valueMode === 'reference' && names.length > 0 ? (
        <div className="grid grid-cols-[minmax(96px,0.7fr)_minmax(0,1.3fr)_auto] gap-2 px-1 text-xs text-muted-foreground">
          <span>变量名</span>
          <span>变量值</span>
          <span className="sr-only">操作</span>
        </div>
      ) : null}
      {Object.entries(values).map(([name, value]) => (
        <VariableBindingField
          key={name}
          name={name}
          value={value}
          names={names}
          values={values}
          types={types}
          variableOptions={variableOptions}
          onChange={onChange}
          nameAriaLabel={nameAriaLabel}
          allowedTypes={allowedTypes}
          valueMode={valueMode}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let name = baseName;
          let index = 1;
          while (values[name] !== undefined) {
            name = `${baseName}${index}`;
            index += 1;
          }
          onChange({ ...values, [name]: '' }, { ...types, [name]: 'string' });
        }}
      >
        <Plus className="mr-2 size-4" />
        {addLabel}
      </Button>
    </div>
  );
}

function VariableBindingField({
  name,
  value,
  names,
  values,
  types,
  variableOptions,
  onChange,
  nameAriaLabel,
  allowedTypes,
  valueMode,
}: Pick<
  VariableBindingEditorProps,
  | 'values'
  | 'types'
  | 'variableOptions'
  | 'onChange'
  | 'nameAriaLabel'
  | 'allowedTypes'
  | 'valueMode'
> & {
  name: string;
  value: unknown;
  names: string[];
}) {
  const stringValue = typeof value === 'string' ? value : String(value ?? '');
  const availableTypes = allowedTypes || defaultValueTypes;
  const hasInvalidReference =
    getInvalidWorkflowVariableTokens(stringValue, variableOptions).length > 0;
  const typeMismatchMessage = getWorkflowBindingTypeMismatchMessage(
    name,
    value,
    types[name],
    variableOptions,
  );
  const fieldErrorMessage = hasInvalidReference
    ? INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE
    : typeMismatchMessage;
  const renameVariable = (nextName: string) => {
    const nextValues = Object.fromEntries(
      Object.entries(values).map(([currentName, currentValue]) => [
        currentName === name ? nextName : currentName,
        currentValue,
      ]),
    );
    const nextTypes = Object.fromEntries(
      Object.keys(values).map((currentName) => [
        currentName === name ? nextName : currentName,
        types[currentName] || 'string',
      ]),
    ) as Record<string, WorkflowValueType>;
    onChange(nextValues, nextTypes);
  };
  const removeVariable = () => {
    const nextValues = { ...values };
    const nextTypes = { ...types };
    delete nextValues[name];
    delete nextTypes[name];
    onChange(nextValues, nextTypes);
  };

  if (valueMode === 'reference') {
    return (
      <div
        aria-invalid={Boolean(fieldErrorMessage) || undefined}
        className={cn(
          'relative space-y-2',
          fieldErrorMessage && 'rounded-lg border border-destructive/70 bg-destructive/5 px-2 py-2',
        )}
      >
        <div className="grid grid-cols-[minmax(96px,0.7fr)_minmax(0,1.3fr)_auto] items-center gap-2">
          <RecordKeyInput
            name={name}
            names={names}
            ariaLabel={nameAriaLabel}
            onCommit={renameVariable}
          />
          <VariableReferencePicker
            ariaLabel={`${name} 变量值`}
            className="w-full"
            value={stringValue}
            onChange={(nextValue) => {
              const selected = variableOptions.find((option) => option.token === nextValue);
              onChange(
                { ...values, [name]: nextValue },
                selected?.type && selected.type !== 'unknown'
                  ? { ...types, [name]: selected.type }
                  : types,
              );
            }}
            options={variableOptions}
            placeholder="选择上游变量"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`删除变量 ${name}`}
            onClick={removeVariable}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
        {fieldErrorMessage ? <BindingErrorInfo message={fieldErrorMessage} /> : null}
      </div>
    );
  }

  return (
    <div
      aria-invalid={Boolean(fieldErrorMessage) || undefined}
      className={cn(
        'relative space-y-2 rounded-lg border border-border p-3',
        fieldErrorMessage && 'border-destructive/70 bg-destructive/5',
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2">
        <RecordKeyInput
          name={name}
          names={names}
          ariaLabel={nameAriaLabel}
          onCommit={renameVariable}
        />
        <Select
          value={types[name] || 'string'}
          onValueChange={(type) =>
            onChange(values, { ...types, [name]: type as WorkflowValueType })
          }
        >
          <SelectTrigger aria-label={`${name} 变量类型`}>{types[name] || 'string'}</SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false} className="min-w-[110px]">
            {availableTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`删除变量 ${name}`}
          onClick={removeVariable}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      {valueMode === 'explicit' ? (
        <TypedVariableBindingPicker
          ariaLabel={`${name} 变量值`}
          type={types[name] || 'string'}
          value={value}
          onChange={(nextValue) => onChange({ ...values, [name]: nextValue }, types)}
          options={variableOptions}
          showType={false}
        />
      ) : (
        <VariableTokenEditor
          ariaLabel={`${name} 变量值`}
          compact
          value={stringValue}
          onChange={(nextValue) => {
            const selected = variableOptions.find((option) => option.token === nextValue);
            const selectedType = selected?.type;
            onChange(
              { ...values, [name]: nextValue },
              selectedType && selectedType !== 'unknown'
                ? { ...types, [name]: selectedType }
                : types,
            );
          }}
          options={variableOptions}
          placeholder="输入固定值或选择上游变量"
        />
      )}
      {fieldErrorMessage ? <BindingErrorInfo message={fieldErrorMessage} /> : null}
    </div>
  );
}
