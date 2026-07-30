export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'template'
  | 'http'
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
  | 'terminate_loop'
  | 'approval'
  | 'delay';

export type WorkflowValueType =
  | 'string'
  | 'string[]'
  | 'array'
  | 'object'
  | 'number'
  | 'boolean'
  | 'file';

export type WorkflowStartInputControl =
  | 'default'
  | 'markdown_file'
  | 'blog_tags'
  | 'blog_group'
  | 'visibility';

export type WorkflowStartInputProvider = 'blog.tags' | 'blog.groups' | 'static.visibility';

const startInputProviders = new Set<WorkflowStartInputProvider>([
  'blog.tags',
  'blog.groups',
  'static.visibility',
]);

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
  category: 'model' | 'content' | 'image' | 'knowledge' | 'flow' | 'logic' | 'tool' | 'subworkflow';
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
  isLoopBodyExit?: boolean;
}

export interface StartInputDefinition {
  id?: string;
  type: WorkflowValueType;
  required: boolean;
  control: WorkflowStartInputControl;
  provider?: WorkflowStartInputProvider;
}

const startInputControls = new Set<WorkflowStartInputControl>([
  'default',
  'markdown_file',
  'blog_tags',
  'blog_group',
  'visibility',
]);

const legacyStartInputControls: Record<string, WorkflowStartInputControl> = {
  markdownFile: 'markdown_file',
  tagIds: 'blog_tags',
  groupId: 'blog_group',
  visibility: 'visibility',
};

const legacyStartInputProviders: Partial<
  Record<WorkflowStartInputControl, WorkflowStartInputProvider>
> = {
  blog_tags: 'blog.tags',
  blog_group: 'blog.groups',
  visibility: 'static.visibility',
};

export function workflowStartInputProviderForControl(control: WorkflowStartInputControl) {
  return legacyStartInputProviders[control];
}

export function workflowStartInputControlType(
  control: WorkflowStartInputControl,
  fallback: WorkflowValueType = 'string',
): WorkflowValueType {
  switch (control) {
    case 'markdown_file':
      return 'file';
    case 'blog_tags':
      return 'string[]';
    case 'blog_group':
    case 'visibility':
      return 'string';
    default:
      return fallback;
  }
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
      (() => {
        if (!name.trim() || !value || !allowed.has(value.type)) return [];
        const configuredControl = value.control;
        const control =
          typeof configuredControl === 'string' &&
          startInputControls.has(configuredControl as WorkflowStartInputControl)
            ? (configuredControl as WorkflowStartInputControl)
            : legacyStartInputControls[name] || 'default';
        return [
          [
            name,
            {
              ...(typeof value.id === 'string' && value.id.trim() ? { id: value.id } : {}),
              type: workflowStartInputControlType(control, value.type),
              required: value.required === true,
              control,
              ...(typeof value.provider === 'string' &&
              startInputProviders.has(value.provider as WorkflowStartInputProvider)
                ? { provider: value.provider as WorkflowStartInputProvider }
                : legacyStartInputProviders[control]
                  ? { provider: legacyStartInputProviders[control] }
                  : {}),
            },
          ],
        ];
      })(),
    ),
  );
}

export function renameStartInput(
  inputs: Record<string, StartInputDefinition>,
  previousName: string,
  nextName: string,
): Record<string, StartInputDefinition> {
  return Object.fromEntries(
    Object.entries(inputs).map(([name, definition]) => [
      name === previousName ? nextName : name,
      definition,
    ]),
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
