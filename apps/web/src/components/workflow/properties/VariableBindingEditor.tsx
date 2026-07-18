import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WorkflowValueType } from '../types';
import { VariableTokenEditor } from '../VariableTokenEditor';
import type { WorkflowVariableOption } from '../workflowVariables';
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
}: VariableBindingEditorProps) {
  const names = Object.keys(values);

  return (
    <div className="space-y-3">
      {Object.entries(values).map(([name, value]) => (
        <div key={name} className="space-y-2 rounded-lg border border-border p-3">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_auto] items-center gap-2">
            <RecordKeyInput
              name={name}
              names={names}
              ariaLabel={nameAriaLabel}
              onCommit={(nextName) => {
                const nextValues = { ...values };
                const nextTypes = { ...types };
                delete nextValues[name];
                delete nextTypes[name];
                nextValues[nextName] = value;
                nextTypes[nextName] = types[name] || 'string';
                onChange(nextValues, nextTypes);
              }}
            />
            <Select
              value={types[name] || 'string'}
              onValueChange={(type) =>
                onChange(values, { ...types, [name]: type as WorkflowValueType })
              }
            >
              <SelectTrigger aria-label={`${name} 变量类型`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedTypes.map((type) => (
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
              onClick={() => {
                const nextValues = { ...values };
                const nextTypes = { ...types };
                delete nextValues[name];
                delete nextTypes[name];
                onChange(nextValues, nextTypes);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <VariableTokenEditor
            ariaLabel={`${name} 变量值`}
            compact
            value={typeof value === 'string' ? value : String(value ?? '')}
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
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          let index = 1;
          while (values[`${baseName}${index}`] !== undefined) index += 1;
          const name = `${baseName}${index}`;
          onChange({ ...values, [name]: '' }, { ...types, [name]: 'string' });
        }}
      >
        <Plus className="mr-2 size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
