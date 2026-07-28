import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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
import { WorkflowIOField } from './WorkflowIOField';

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
      <WorkflowIOField
        name={name}
        type={types[name] || 'string'}
        error={fieldErrorMessage || undefined}
        nameControl={
          <RecordKeyInput
            name={name}
            names={names}
            ariaLabel={nameAriaLabel}
            onCommit={renameVariable}
          />
        }
        valueControl={
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
        }
        actions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`删除变量 ${name}`}
            onClick={removeVariable}
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
    );
  }

  return (
    <WorkflowIOField
      name={name}
      error={fieldErrorMessage || undefined}
      nameControl={
        <RecordKeyInput
          name={name}
          names={names}
          ariaLabel={nameAriaLabel}
          onCommit={renameVariable}
        />
      }
      typeControl={
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
      }
      actions={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`删除变量 ${name}`}
          onClick={removeVariable}
        >
          <Trash2 className="size-4" />
        </Button>
      }
      valueControl={
        valueMode === 'explicit' ? (
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
        )
      }
    />
  );
}
