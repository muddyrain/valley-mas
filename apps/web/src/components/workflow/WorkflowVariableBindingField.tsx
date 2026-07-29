import { WorkflowIOField } from './properties/WorkflowIOField';
import { TypedVariableBindingPicker } from './TypedVariableBindingPicker';
import { TypedVariableValueEditor } from './TypedVariableValueEditor';
import type { WorkflowValueType } from './types';
import type { WorkflowVariableOption } from './workflowVariables';

interface WorkflowVariableBindingFieldProps {
  name?: string;
  label: string;
  type: WorkflowValueType;
  value: unknown;
  onChange: (value: unknown) => void;
  options: WorkflowVariableOption[];
  description?: string;
  required?: boolean;
  error?: string;
  ariaLabel?: string;
  allowFixed?: boolean;
  fixedPlaceholder?: string;
  multiline?: boolean;
}

// Shared binding card for fields whose name and type are defined by the caller.
// The title and picker occupy separate lines so either can use the full panel width.
export function WorkflowVariableBindingField({
  name,
  label,
  type,
  value,
  onChange,
  options,
  description,
  required = false,
  error,
  ariaLabel,
  allowFixed = false,
  fixedPlaceholder,
  multiline = false,
}: WorkflowVariableBindingFieldProps) {
  return (
    <WorkflowIOField
      name={name || label}
      label={label}
      type={type}
      required={required}
      description={description}
      error={error}
      valueControl={
        allowFixed ? (
          <TypedVariableValueEditor
            ariaLabel={ariaLabel || `${label} 输入值`}
            type={type}
            value={value}
            onChange={onChange}
            options={options}
            fixedPlaceholder={fixedPlaceholder}
            multiline={multiline}
          />
        ) : (
          <TypedVariableBindingPicker
            ariaLabel={ariaLabel || `${label} 输入值`}
            type={type}
            value={value}
            onChange={(nextValue) => onChange(nextValue)}
            options={options}
          />
        )
      }
    />
  );
}
