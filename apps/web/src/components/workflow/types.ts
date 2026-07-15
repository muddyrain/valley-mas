export type WorkflowNodeType =
  | 'start'
  | 'blog.parseMarkdown'
  | 'knowledge.retrieve'
  | 'llm.text'
  | 'blog.createDraft'
  | 'end'
  | 'input'
  | 'fileUpload'
  | 'knowledge'
  | 'code'
  | 'http'
  | 'condition'
  | 'loop'
  | 'variable';

export interface WorkflowNodeConfig {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: string;
  category: 'ai' | 'action' | 'control' | 'data';
  handles: { input?: boolean; output?: boolean; outputs?: number };
  fixed?: boolean;
  available?: boolean;
}

export interface WorkflowNodeData {
  label: string;
  nodeType: WorkflowNodeType;
  config?: Record<string, unknown>;
  runningState?: 'idle' | 'running' | 'success' | 'error';
  collapsed?: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
}

export interface StartInputDefinition {
  type: 'string' | 'string[]' | 'object' | 'number' | 'boolean' | 'file';
  required: boolean;
}

export const PHASE_ONE_START_INPUTS: Record<string, StartInputDefinition> = {
  markdownFile: { type: 'file', required: true },
  tagIds: { type: 'string[]', required: false },
  groupId: { type: 'string', required: false },
  visibility: { type: 'string', required: true },
};

export function normalizePhaseOneStartInputs(
  inputs: unknown,
): Record<string, StartInputDefinition> {
  const configured = inputs && typeof inputs === 'object' ? inputs : null;
  if (!configured || Object.keys(configured).length === 0) {
    return PHASE_ONE_START_INPUTS;
  }
  const allowedTypes = new Set<StartInputDefinition['type']>([
    'string',
    'string[]',
    'object',
    'number',
    'boolean',
    'file',
  ]);
  return Object.fromEntries(
    Object.entries(configured as Record<string, StartInputDefinition>).flatMap(([name, value]) =>
      name.trim() && value && allowedTypes.has(value.type)
        ? [[name, { type: value.type, required: value.required === true }]]
        : [],
    ),
  );
}

export interface StartConfig {
  inputs: Record<string, StartInputDefinition>;
}

export interface LLMTextConfig {
  modelProfile: 'ark-text-default';
  systemPrompt: string;
  prompt: string;
  temperature: number;
  maxOutputTokens: number;
}

export interface ParseMarkdownConfig {
  fileInput: string;
}

export interface CreateDraftConfig {
  title: string;
  content: string;
  excerpt?: string;
  cover?: string;
  tags: string;
  suggestedTags?: string;
  tagMode: 'merge' | 'manual_only';
  visibility: string;
}

export interface EndConfig {
  outputs: Record<string, string>;
}
