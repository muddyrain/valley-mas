import type { Edge, Node } from '@xyflow/react';

export interface WorkflowVariableOption {
  nodeId: string;
  nodeLabel: string;
  field: string;
  type: 'string' | 'string[]' | 'array' | 'object' | 'number' | 'boolean' | 'file' | 'unknown';
  token: string;
  scope?: 'upstream' | 'local';
}

export function workflowValueTypeLabel(type: WorkflowVariableOption['type']) {
  switch (type) {
    case 'string':
      return '文本';
    case 'string[]':
      return '文本列表';
    case 'array':
      return '数组';
    case 'number':
      return '数字';
    case 'boolean':
      return '布尔值';
    case 'object':
      return '对象';
    case 'file':
      return '文件';
    default:
      return '变量';
  }
}

export type TemplateSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; token: string; option?: WorkflowVariableOption };

type WorkflowVariableType = WorkflowVariableOption['type'];
export type WorkflowOutputField = readonly [string, WorkflowVariableType];

interface WorkflowNodeData {
  label?: unknown;
  nodeType?: unknown;
  config?: unknown;
}

const NODE_OUTPUT_FIELDS: Record<string, ReadonlyArray<readonly [string, WorkflowVariableType]>> = {
  llm: [
    ['text', 'string'],
    ['model', 'string'],
    ['tokenUsage', 'number'],
  ],
  condition: [['matched', 'boolean']],
  switch: [
    ['matchedCaseId', 'string'],
    ['matchedLabel', 'string'],
    ['matchedValue', 'unknown'],
  ],
  intent: [
    ['intentId', 'string'],
    ['intentName', 'string'],
    ['confidence', 'number'],
  ],
};

const TOOL_OUTPUT_FIELDS: Record<string, ReadonlyArray<readonly [string, WorkflowVariableType]>> = {
  'content.parseMarkdown': [
    ['title', 'string'],
    ['content', 'string'],
    ['frontMatter', 'object'],
    ['excerpt', 'string'],
    ['cover', 'object'],
    ['tagNames', 'string[]'],
  ],
  'knowledge.retrieve': [
    ['context', 'string'],
    ['references', 'object'],
  ],
  'content.search': [
    ['count', 'number'],
    ['items', 'object'],
  ],
  'notion.search': [
    ['count', 'number'],
    ['results', 'object'],
  ],
  'image.generateCover': [
    ['imageUrl', 'string'],
    ['cover', 'object'],
    ['url', 'string'],
    ['model', 'string'],
    ['size', 'string'],
  ],
  'blog.createDraft': [
    ['postId', 'string'],
    ['title', 'string'],
    ['editPath', 'string'],
    ['tagIds', 'string[]'],
  ],
};

const START_VARIABLE_TYPES = new Set<WorkflowVariableType>([
  'string',
  'string[]',
  'array',
  'object',
  'number',
  'boolean',
  'file',
]);

// Keep unfinished references visible to the editor so they can be marked invalid while typing.
const WORKFLOW_VARIABLE_PATTERN = /\{\{[^\n]*?(?:\}\}|$)/g;

function getNodeData(node: Node): WorkflowNodeData {
  return node.data as WorkflowNodeData;
}

function getNodeType(node: Node): string {
  const data = getNodeData(node);
  return node.type === 'workflowNode' && typeof data.nodeType === 'string'
    ? data.nodeType
    : node.type || (typeof data.nodeType === 'string' ? data.nodeType : '');
}

function getNodeLabel(node: Node): string {
  const label = getNodeData(node).label;
  return typeof label === 'string' && label.trim() ? label : node.id;
}

function getStartOutputFields(
  config: Record<string, unknown> | undefined,
): ReadonlyArray<WorkflowOutputField> {
  if (!config || typeof config !== 'object') return [];
  const inputs = config.inputs;
  if (!inputs || typeof inputs !== 'object') return [];

  return Object.entries(inputs as Record<string, unknown>).flatMap(([field, definition]) => {
    if (!field.trim() || !definition || typeof definition !== 'object') return [];
    const configuredType = (definition as { type?: unknown }).type;
    if (
      typeof configuredType !== 'string' ||
      !START_VARIABLE_TYPES.has(configuredType as WorkflowVariableType)
    ) {
      return [];
    }
    return [[field, configuredType as WorkflowVariableType]];
  });
}

export function getWorkflowNodeOutputFields(
  nodeType: string,
  config: Record<string, unknown> = {},
): ReadonlyArray<WorkflowOutputField> {
  if (nodeType === 'llm') {
    const outputSchema =
      config.outputMode === 'json' && config.outputSchema && typeof config.outputSchema === 'object'
        ? (config.outputSchema as Record<string, WorkflowVariableType>)
        : null;
    return outputSchema
      ? [
          ...Object.entries(outputSchema).map(([name, type]) => [name, type] as const),
          ['model', 'string'],
          ['tokenUsage', 'number'],
        ]
      : NODE_OUTPUT_FIELDS.llm;
  }
  if (nodeType === 'start') return getStartOutputFields(config);
  if (nodeType === 'end') {
    const outputs =
      config.outputs && typeof config.outputs === 'object'
        ? (config.outputs as Record<string, unknown>)
        : {};
    const outputTypes =
      config.outputTypes && typeof config.outputTypes === 'object'
        ? (config.outputTypes as Record<string, WorkflowVariableType>)
        : {};
    return Object.keys(outputs).map((name) => [name, outputTypes[name] || 'unknown'] as const);
  }
  if (nodeType === 'loop') {
    const outputs = Array.isArray(config.outputs) ? config.outputs : [];
    return outputs.flatMap((item) =>
      item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
        ? [[String((item as { name: string }).name), 'array'] as const]
        : [],
    );
  }
  if (nodeType === 'variable') {
    const assignments = config.assignments;
    return Array.isArray(assignments)
      ? assignments.flatMap((item) =>
          item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
            ? [
                [
                  String((item as { name: string }).name),
                  String((item as { type?: unknown }).type || 'unknown') as WorkflowVariableType,
                ] as const,
              ]
            : [],
        )
      : [];
  }
  if (nodeType === 'merge') {
    const fields = config.fields;
    return Array.isArray(fields)
      ? fields.flatMap((item) =>
          item && typeof item === 'object' && typeof (item as { name?: unknown }).name === 'string'
            ? [
                [
                  String((item as { name: string }).name),
                  String((item as { type?: unknown }).type || 'unknown') as WorkflowVariableType,
                ] as const,
              ]
            : [],
        )
      : [];
  }
  if (nodeType === 'tool') {
    const capabilityId = config.capabilityId;
    return typeof capabilityId === 'string' ? TOOL_OUTPUT_FIELDS[capabilityId] || [] : [];
  }
  if (nodeType === 'subworkflow') {
    const outputSchema = config.outputSchema;
    if (!outputSchema || typeof outputSchema !== 'object') return [];
    return Object.entries(outputSchema as Record<string, WorkflowVariableType>).flatMap(
      ([name, type]) =>
        typeof type === 'string' && START_VARIABLE_TYPES.has(type as WorkflowVariableType)
          ? [[name, type as WorkflowVariableType] as const]
          : [],
    );
  }
  return NODE_OUTPUT_FIELDS[nodeType] || [];
}

function getOutputFields(node: Node): ReadonlyArray<WorkflowOutputField> {
  const rawConfig = getNodeData(node).config;
  const config =
    rawConfig && typeof rawConfig === 'object' ? (rawConfig as Record<string, unknown>) : undefined;
  return getWorkflowNodeOutputFields(getNodeType(node), config);
}

/** Returns only variables exposed by nodes that can reach the target node. */
export function getUpstreamWorkflowVariables(
  nodes: Node[],
  edges: Edge[],
  targetNodeID: string,
): WorkflowVariableOption[] {
  const nodeIDs = new Set(nodes.map((node) => node.id));
  if (!nodeIDs.has(targetNodeID)) return [];

  const parentsByNodeID = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodeIDs.has(edge.source) || !nodeIDs.has(edge.target)) continue;
    const parents = parentsByNodeID.get(edge.target) || [];
    parents.push(edge.source);
    parentsByNodeID.set(edge.target, parents);
  }

  const ancestorIDs = new Set<string>();
  const pending = [...(parentsByNodeID.get(targetNodeID) || [])];
  while (pending.length > 0) {
    const nodeID = pending.pop();
    if (!nodeID || ancestorIDs.has(nodeID)) continue;
    ancestorIDs.add(nodeID);
    pending.push(...(parentsByNodeID.get(nodeID) || []));
  }

  const upstream = nodes.flatMap((node) => {
    if (!ancestorIDs.has(node.id)) return [];
    return getOutputFields(node).map(([field, type]) => ({
      nodeId: node.id,
      nodeLabel: getNodeLabel(node),
      field,
      type,
      token: `{{${node.id}.output.${field}}}`,
      scope: 'upstream' as const,
    }));
  });

  const target = nodes.find((node) => node.id === targetNodeID);
  if (!target || getNodeType(target) !== 'llm') return upstream;
  const config = getNodeData(target).config;
  if (!config || typeof config !== 'object') return upstream;
  const inputs = (config as Record<string, unknown>).inputs;
  const inputTypes = (config as Record<string, unknown>).inputTypes;
  if (!inputs || typeof inputs !== 'object') return upstream;
  const types = inputTypes && typeof inputTypes === 'object' ? inputTypes : {};
  const local = Object.keys(inputs as Record<string, unknown>)
    .filter((field) => field.trim())
    .map((field) => ({
      nodeId: targetNodeID,
      nodeLabel: '本节点输入',
      field,
      type: String((types as Record<string, unknown>)[field] || 'unknown') as WorkflowVariableType,
      token: `{{${field}}}`,
      scope: 'local' as const,
    }));
  return [...local, ...upstream];
}

export function splitWorkflowTemplate(
  value: string,
  options: WorkflowVariableOption[],
): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  let textStart = 0;

  for (const match of value.matchAll(WORKFLOW_VARIABLE_PATTERN)) {
    const matchStart = match.index ?? 0;
    if (matchStart > textStart) {
      segments.push({ type: 'text', value: value.slice(textStart, matchStart) });
    }
    const token = match[0];
    const normalizedToken = normalizeWorkflowVariableToken(token);
    // Keep an unfinished `{{ }}` draft editable so the user can continue typing
    // while the contextual variable picker remains open.
    const option = getWorkflowVariableOption(token, options);
    if (normalizedToken && option) {
      segments.push({ type: 'variable', token, option });
    } else {
      segments.push({ type: 'text', value: token });
    }
    textStart = matchStart + token.length;
  }

  if (textStart < value.length || segments.length === 0) {
    segments.push({ type: 'text', value: value.slice(textStart) });
  }
  return segments;
}

function normalizeWorkflowVariableToken(token: string): string | null {
  const match = token.match(/^\{\{\s*([^{}]+?)\s*\}\}$/);
  if (!match) return null;
  return `{{${match[1].trim()}}}`;
}

export function getWorkflowVariableOption(
  token: string,
  options: WorkflowVariableOption[],
): WorkflowVariableOption | undefined {
  const normalized = normalizeWorkflowVariableToken(token);
  return normalized ? options.find((option) => option.token === normalized) : undefined;
}

export function getInvalidWorkflowVariableTokens(
  value: string,
  options: WorkflowVariableOption[],
): string[] {
  const tokens = value.match(WORKFLOW_VARIABLE_PATTERN) || [];
  return [...new Set(tokens.filter((token) => !getWorkflowVariableOption(token, options)))];
}
