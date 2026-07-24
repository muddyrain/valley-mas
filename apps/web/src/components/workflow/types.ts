export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'tool'
  | 'condition'
  | 'switch'
  | 'merge'
  | 'variable'
  | 'subworkflow'
  | 'intent'
  | 'loop'
  | 'set_loop_variable'
  | 'continue_loop'
  | 'terminate_loop';

export type WorkflowValueType =
  | 'string'
  | 'string[]'
  | 'array'
  | 'object'
  | 'number'
  | 'boolean'
  | 'file';

export interface WorkflowRule {
  left: unknown;
  operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'greaterThan' | 'lessThan';
  right?: unknown;
}

export interface WorkflowNodeConfig {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: string;
  category: 'model' | 'flow' | 'logic' | 'tool' | 'subworkflow';
  handles: { input?: boolean; output?: boolean; outputs?: number };
  fixed?: boolean;
  whenAllowed?: boolean;
}

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  config?: Record<string, unknown>;
  when?: WorkflowRule;
  capabilityName?: string;
  sideEffect?: string;
  runningState?: 'idle' | 'running' | 'success' | 'error' | 'skipped';
  loopParentId?: string;
  loopBodyNodeId?: string;
  loopBodyNodeCount?: number;
  isLoopBody?: boolean;
}

export interface StartInputDefinition {
  type: WorkflowValueType;
  required: boolean;
}

export function normalizeStartInputs(inputs: unknown): Record<string, StartInputDefinition> {
  if (!inputs || typeof inputs !== 'object') return {};
  const allowed = new Set<WorkflowValueType>([
    'string',
    'string[]',
    'array',
    'object',
    'number',
    'boolean',
    'file',
  ]);
  return Object.fromEntries(
    Object.entries(inputs as Record<string, StartInputDefinition>).flatMap(([name, value]) =>
      name.trim() && value && allowed.has(value.type)
        ? [[name, { type: value.type, required: value.required === true }]]
        : [],
    ),
  );
}

export interface WorkflowVariableAssignment {
  name: string;
  type: WorkflowValueType;
  value: unknown;
}

export interface WorkflowMergeField {
  name: string;
  type: WorkflowValueType;
  sources: string[];
}

export interface WorkflowIntentDefinition {
  id: string;
  name: string;
  description: string;
  examples: string[];
}

export interface WorkflowSwitchCase {
  id: string;
  label: string;
  value: string | number | boolean;
}
