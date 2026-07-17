import type { Edge, Node } from '@xyflow/react';

export interface WorkflowVariableOption {
  nodeId: string;
  nodeLabel: string;
  field: string;
  type: 'string' | 'string[]' | 'object' | 'number' | 'boolean' | 'file' | 'unknown';
  token: string;
}

export type TemplateSegment =
  | { type: 'text'; value: string }
  | { type: 'variable'; token: string; option?: WorkflowVariableOption };

type WorkflowVariableType = WorkflowVariableOption['type'];

interface WorkflowNodeData {
  label?: unknown;
  nodeType?: unknown;
  config?: unknown;
}

const NODE_OUTPUT_FIELDS: Record<string, ReadonlyArray<readonly [string, WorkflowVariableType]>> = {
  'blog.parseMarkdown': [
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
  'llm.text': [
    ['text', 'string'],
    ['model', 'string'],
    ['tokenUsage', 'number'],
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

function getStartOutputFields(node: Node): ReadonlyArray<readonly [string, WorkflowVariableType]> {
  const config = getNodeData(node).config;
  if (!config || typeof config !== 'object') return [];
  const inputs = (config as { inputs?: unknown }).inputs;
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

function getOutputFields(node: Node): ReadonlyArray<readonly [string, WorkflowVariableType]> {
  const nodeType = getNodeType(node);
  if (nodeType === 'start') return getStartOutputFields(node);
  if (nodeType === 'variable') {
    const config = getNodeData(node).config;
    const variableName =
      config && typeof config === 'object'
        ? (config as { variableName?: unknown }).variableName
        : undefined;
    return typeof variableName === 'string' && variableName.trim()
      ? [[variableName.trim(), 'string']]
      : [];
  }
  return NODE_OUTPUT_FIELDS[nodeType] || [];
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

  return nodes.flatMap((node) => {
    if (!ancestorIDs.has(node.id)) return [];
    return getOutputFields(node).map(([field, type]) => ({
      nodeId: node.id,
      nodeLabel: getNodeLabel(node),
      field,
      type,
      token: `{{${node.id}.output.${field}}}`,
    }));
  });
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
    segments.push({ type: 'variable', token, option: getWorkflowVariableOption(token, options) });
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
