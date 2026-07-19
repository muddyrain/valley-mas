import type { WorkflowValueType } from './types';

export interface PublishedWorkflowContract {
  inputSchema: Record<string, WorkflowValueType>;
  outputSchema: Record<string, WorkflowValueType>;
  requiredInputs: string[];
}

export interface SubworkflowContractIssue {
  scope: 'input' | 'output';
  name: string;
  reason: 'removed' | 'type_changed' | 'required_added';
}

const workflowValueTypes = new Set<WorkflowValueType>([
  'string',
  'string[]',
  'object',
  'number',
  'boolean',
  'file',
]);

export function normalizeSubworkflowSchema(raw: unknown): Record<string, WorkflowValueType> {
  if (!raw || typeof raw !== 'object') return {};
  const schema: Record<string, WorkflowValueType> = {};
  for (const [name, type] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof type === 'string' && workflowValueTypes.has(type as WorkflowValueType)) {
      schema[name] = type as WorkflowValueType;
    }
  }
  return schema;
}

export function publishedWorkflowContract(rawGraph: string): PublishedWorkflowContract {
  const contract: PublishedWorkflowContract = {
    inputSchema: {},
    outputSchema: {},
    requiredInputs: [],
  };
  try {
    const graph = JSON.parse(rawGraph) as {
      nodes?: Array<{ type?: string; config?: Record<string, unknown> }>;
    };
    const startInputs = graph.nodes?.find((node) => node.type === 'start')?.config?.inputs;
    if (startInputs && typeof startInputs === 'object') {
      for (const [name, definition] of Object.entries(startInputs as Record<string, unknown>)) {
        const type =
          definition && typeof definition === 'object'
            ? (definition as { type?: unknown }).type
            : undefined;
        if (typeof type === 'string' && workflowValueTypes.has(type as WorkflowValueType)) {
          contract.inputSchema[name] = type as WorkflowValueType;
          if ((definition as { required?: unknown }).required === true) {
            contract.requiredInputs.push(name);
          }
        }
      }
    }
    const endConfig = graph.nodes?.find((node) => node.type === 'end')?.config;
    const endOutputs = endConfig?.outputs;
    const endOutputTypes = endConfig?.outputTypes;
    if (
      endOutputs &&
      typeof endOutputs === 'object' &&
      endOutputTypes &&
      typeof endOutputTypes === 'object'
    ) {
      for (const name of Object.keys(endOutputs as Record<string, unknown>)) {
        const type = (endOutputTypes as Record<string, unknown>)[name];
        if (typeof type === 'string' && workflowValueTypes.has(type as WorkflowValueType)) {
          contract.outputSchema[name] = type as WorkflowValueType;
        }
      }
    }
  } catch {
    // The server validates persisted workflow versions before execution.
  }
  return contract;
}

export function compareSubworkflowContracts(
  current: PublishedWorkflowContract,
  target: PublishedWorkflowContract,
): SubworkflowContractIssue[] {
  const issues: SubworkflowContractIssue[] = [];
  for (const [name, type] of Object.entries(current.inputSchema)) {
    if (!(name in target.inputSchema)) {
      issues.push({ scope: 'input', name, reason: 'removed' });
    } else if (target.inputSchema[name] !== type) {
      issues.push({ scope: 'input', name, reason: 'type_changed' });
    }
  }
  for (const name of target.requiredInputs) {
    if (!(name in current.inputSchema)) {
      issues.push({ scope: 'input', name, reason: 'required_added' });
    }
  }
  for (const [name, type] of Object.entries(current.outputSchema)) {
    if (!(name in target.outputSchema)) {
      issues.push({ scope: 'output', name, reason: 'removed' });
    } else if (target.outputSchema[name] !== type) {
      issues.push({ scope: 'output', name, reason: 'type_changed' });
    }
  }
  return issues;
}
