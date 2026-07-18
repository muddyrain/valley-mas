import type { Edge, Node } from '@xyflow/react';
import { NODE_CONFIGS } from './nodeConfig';
import type { WorkflowNodeData } from './types';
import {
  getInvalidWorkflowVariableTokens,
  getUpstreamWorkflowVariables,
  getWorkflowVariableOption,
} from './workflowVariables';

export interface ValidationError {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  message: string;
}

const WORKFLOW_REFERENCE_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const WORKFLOW_RULE_OPERATORS = new Set([
  'equals',
  'notEquals',
  'contains',
  'isEmpty',
  'greaterThan',
  'lessThan',
]);

function stringsInValue(value: unknown): string[] {
  const values: string[] = [];
  const visit = (current: unknown) => {
    if (typeof current === 'string') values.push(current);
    else if (Array.isArray(current)) current.forEach(visit);
    else if (current && typeof current === 'object') Object.values(current).forEach(visit);
  };
  visit(value);
  return values;
}

function valuesWithReferences(data: WorkflowNodeData): string[] {
  return [...stringsInValue(data.config), ...stringsInValue(data.when)];
}

function workflowReferences(value: unknown): string[] {
  return stringsInValue(value).flatMap((text) =>
    [...text.matchAll(WORKFLOW_REFERENCE_PATTERN)].map((match) => match[1].trim()),
  );
}

function referencedNodeID(reference: string): string | null {
  const match = reference.match(/^([^.\s]+)\.output\.[^.\s]+$/);
  return match?.[1] || null;
}

function validateNode(
  node: Node,
  nodes: Node[],
  edges: Edge[],
  validateReferences = true,
): ValidationError | null {
  const data = node.data as unknown as WorkflowNodeData;
  const config = data.config || {};
  const fail = (message: string): ValidationError => ({
    nodeId: node.id,
    nodeLabel: data.label || node.id,
    nodeType: data.nodeType,
    message,
  });
  if (!NODE_CONFIGS[data.nodeType]) return fail('未识别的 Graph v4 节点类型');
  if (data.when) {
    if (!WORKFLOW_RULE_OPERATORS.has(data.when.operator)) return fail('执行条件的操作符无效');
    if (data.when.left === undefined || String(data.when.left).trim() === '')
      return fail('请选择上游变量作为执行条件');
  }
  switch (data.nodeType) {
    case 'llm':
      if (!config.prompt) return fail('请填写用户提示词');
      break;
    case 'tool':
      if (!config.capabilityId || !config.inputs || typeof config.inputs !== 'object')
        return fail('请选择工具并完成输入映射');
      break;
    case 'condition':
      if (config.left === undefined || !config.operator) return fail('请完成受控条件规则');
      break;
    case 'merge': {
      const fields = Array.isArray(config.fields)
        ? (config.fields as Array<{ name?: string; sources?: unknown[] }>)
        : [];
      if (
        !fields.length ||
        fields.some(
          (field) => !field.name || !Array.isArray(field.sources) || field.sources.length < 2,
        )
      )
        return fail('每个合并字段至少需要两个候选引用');
      break;
    }
    case 'variable': {
      const assignments = Array.isArray(config.assignments)
        ? (config.assignments as Array<{ name?: string }>)
        : [];
      if (!assignments.length || assignments.some((item) => !item.name))
        return fail('请至少添加一个命名变量');
      break;
    }
    case 'subworkflow':
      if (!config.workflowId || !config.versionId) return fail('请选择已发布工作流版本');
      break;
  }
  const options = getUpstreamWorkflowVariables(nodes, edges, node.id);
  if (validateReferences && (data.nodeType === 'end' || data.nodeType === 'llm')) {
    const bindings =
      data.nodeType === 'end'
        ? (config.outputs as Record<string, unknown>) || {}
        : (config.inputs as Record<string, unknown>) || {};
    const bindingTypes =
      data.nodeType === 'end'
        ? (config.outputTypes as Record<string, string>) || {}
        : (config.inputTypes as Record<string, string>) || {};
    for (const [name, value] of Object.entries(bindings)) {
      if (typeof value !== 'string') continue;
      const option = getWorkflowVariableOption(value, options);
      if (option && bindingTypes[name] && option.type !== bindingTypes[name]) {
        const bindingLabel = data.nodeType === 'end' ? '输出' : '输入';
        return fail(
          `${bindingLabel}“${name}”选择了 ${option.type} 变量，但声明类型为 ${bindingTypes[name]}`,
        );
      }
    }
  }
  if (
    validateReferences &&
    valuesWithReferences(data).some(
      (value) => getInvalidWorkflowVariableTokens(value, options).length > 0,
    )
  )
    return fail('变量引用必须来自上游节点输出');
  return null;
}

function validateOptionalEndOutputs(nodes: Node[]): ValidationError[] {
  const nodeByID = new Map(nodes.map((node) => [node.id, node]));

  return nodes.flatMap((node) => {
    const data = node.data as unknown as WorkflowNodeData;
    if (data.nodeType !== 'end') return [];
    const outputs = data.config?.outputs;
    if (!outputs || typeof outputs !== 'object') return [];
    const outputTypes =
      data.config?.outputTypes && typeof data.config.outputTypes === 'object'
        ? (data.config.outputTypes as Record<string, unknown>)
        : {};

    for (const [name, value] of Object.entries(outputs)) {
      const optionalSource = workflowReferences(value)
        .map(referencedNodeID)
        .filter((nodeID): nodeID is string => Boolean(nodeID))
        .map((nodeID) => nodeByID.get(nodeID))
        .find((source) => (source?.data as unknown as WorkflowNodeData | undefined)?.when);
      if (!optionalSource || outputTypes[name] === 'string') continue;

      const sourceData = optionalSource.data as unknown as WorkflowNodeData;
      return [
        workflowError(
          `“${sourceData.label || optionalSource.id}”可能跳过，只能直接映射到 string 结束输出。`,
          node,
        ),
      ];
    }
    return [];
  });
}

export function validateWorkflowConfig(nodes: Node[], edges: Edge[] = []): ValidationError[] {
  const errors = nodes
    .map((node) => validateNode(node, nodes, edges))
    .filter((error): error is ValidationError => error !== null);
  if (nodes.length > 30)
    errors.unshift({
      nodeId: nodes[0]?.id || 'workflow',
      nodeLabel: '工作流',
      nodeType: 'workflow',
      message: 'Graph v4 最多支持 30 个节点',
    });
  return errors;
}

function workflowError(message: string, node?: Node): ValidationError {
  const data = node?.data as unknown as WorkflowNodeData | undefined;
  return {
    nodeId: node?.id || 'workflow',
    nodeLabel: data?.label || '工作流',
    nodeType: data?.nodeType || 'workflow',
    message,
  };
}

/** Mirrors the graph-shape checks that block server persistence without running tools. */
export function validateWorkflowDraft(nodes: Node[], edges: Edge[] = []): ValidationError[] {
  const errors = [...validateWorkflowConfig(nodes, edges), ...validateOptionalEndOutputs(nodes)];
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const starts = nodes.filter(
    (node) => (node.data as unknown as WorkflowNodeData).nodeType === 'start',
  );
  const ends = nodes.filter(
    (node) => (node.data as unknown as WorkflowNodeData).nodeType === 'end',
  );
  if (starts.length !== 1) errors.push(workflowError('必须且只能有一个开始节点'));
  if (ends.length !== 1) errors.push(workflowError('必须且只能有一个结束节点'));

  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, 0]));
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));
  const conditionHandles = new Map<string, { true: number; false: number }>();
  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) {
      errors.push(workflowError('连线引用了不存在的节点', source || target));
      continue;
    }
    incoming.set(target.id, (incoming.get(target.id) || 0) + 1);
    outgoing.set(source.id, (outgoing.get(source.id) || 0) + 1);
    adjacency.get(source.id)?.push(target.id);
    const sourceData = source.data as unknown as WorkflowNodeData;
    if (sourceData.nodeType === 'condition') {
      const counts = conditionHandles.get(source.id) || { true: 0, false: 0 };
      if (edge.sourceHandle === 'true') counts.true += 1;
      if (edge.sourceHandle === 'false') counts.false += 1;
      conditionHandles.set(source.id, counts);
    }
  }

  for (const node of nodes) {
    const data = node.data as unknown as WorkflowNodeData;
    if (data.nodeType !== 'start' && (incoming.get(node.id) || 0) === 0) {
      errors.push(workflowError('无法从开始节点到达', node));
    }
    if (data.nodeType !== 'end' && (outgoing.get(node.id) || 0) === 0) {
      errors.push(workflowError('无法到达结束节点', node));
    }
    if (data.nodeType === 'condition') {
      const counts = conditionHandles.get(node.id) || { true: 0, false: 0 };
      if (counts.true !== 1 || counts.false !== 1) {
        errors.push(workflowError('必须各有一条 true / false 连线', node));
      }
    }
  }

  const remainingIncoming = new Map(incoming);
  const queue = nodes
    .filter((node) => (remainingIncoming.get(node.id) || 0) === 0)
    .map((node) => node.id);
  let visited = 0;
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    visited += 1;
    for (const target of adjacency.get(id) || []) {
      const next = (remainingIncoming.get(target) || 0) - 1;
      remainingIncoming.set(target, next);
      if (next === 0) queue.push(target);
    }
  }
  if (visited !== nodes.length) errors.push(workflowError('工作流不能包含循环'));
  return errors;
}

export function validateSingleNode(data: WorkflowNodeData): ValidationError | null {
  return validateNode(
    { id: 'temp', data: data as unknown as Record<string, unknown>, position: { x: 0, y: 0 } },
    [],
    [],
    false,
  );
}
export function hasUnconfiguredNodes(nodes: Node[]): boolean {
  return validateWorkflowConfig(nodes).length > 0;
}
export function getUnconfiguredNodeLabels(nodes: Node[]): string[] {
  return validateWorkflowConfig(nodes).map((error) => error.nodeLabel);
}
