import type { WorkflowToolCapability } from '@/api/workflow';

export interface WorkflowToolInputError {
  field: string;
  message: string;
}

function isEmptyRequiredInput(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export function validateToolCapabilityInputs(
  capability: WorkflowToolCapability,
  inputs: Record<string, unknown>,
): WorkflowToolInputError[] {
  const properties = capability.inputSchema.properties || {};
  return (capability.inputSchema.required || []).flatMap((name) => {
    const schema = properties[name];
    const value = name in inputs ? inputs[name] : schema?.default;
    if (!isEmptyRequiredInput(value)) return [];
    return [
      {
        field: name,
        message: `必填输入“${schema?.title || name}”不能为空`,
      },
    ];
  });
}
