import type { Edge, Node } from '@xyflow/react';
import { NODE_CONFIGS } from './nodeConfig';
import type { WorkflowNodeData } from './types';
import {
  getInvalidWorkflowVariableTokens,
  getUpstreamWorkflowVariables,
  getWorkflowVariableOption,
  type WorkflowVariableOption,
  workflowValueTypeLabel,
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
const INTENT_ID_PATTERN = /^[a-z][a-z0-9_-]{0,39}$/;
export const INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE = '关联的上游变量已失效，请重新选择变量';

export function getWorkflowBindingTypeMismatchMessage(
  name: string,
  value: unknown,
  expected: WorkflowVariableOption['type'] | undefined,
  options: WorkflowVariableOption[],
): string | null {
  if (!expected || expected === 'unknown') return null;
  if (typeof value !== 'string') return null;
  const option = getWorkflowVariableOption(value, options);
  if (option && option.type !== expected) {
    return `字段“${name}”声明为${workflowValueTypeLabel(expected)}，但引用变量为${workflowValueTypeLabel(option.type)}`;
  }
  return null;
}

function intentOutputHandles(config: Record<string, unknown>): string[] {
  const intents = Array.isArray(config.intents) ? config.intents : [];
  const handles = intents.flatMap((intent) => {
    if (!intent || typeof intent !== 'object') return [];
    const id = (intent as { id?: unknown }).id;
    return typeof id === 'string' && INTENT_ID_PATTERN.test(id) && id !== 'other'
      ? [`intent:${id}`]
      : [];
  });
  return [...handles, 'intent:other'];
}

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
      if (
        config.outputMode === 'json' &&
        (!config.outputSchema ||
          typeof config.outputSchema !== 'object' ||
          Object.keys(config.outputSchema as Record<string, unknown>).length === 0)
      )
        return fail('请至少声明一个 JSON 输出字段');
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
    case 'intent': {
      const intents = Array.isArray(config.intents) ? config.intents : [];
      if (!config.query || !String(config.query).trim()) return fail('请选择分类输入变量');
      if (!intents.length || intents.length > 10) return fail('请设置 1 到 10 个意图');
      const ids = new Set<string>();
      for (const item of intents) {
        if (!item || typeof item !== 'object') return fail('意图配置无效');
        const intent = item as { id?: unknown; name?: unknown };
        if (
          typeof intent.id !== 'string' ||
          !INTENT_ID_PATTERN.test(intent.id) ||
          intent.id === 'other' ||
          ids.has(intent.id) ||
          typeof intent.name !== 'string' ||
          !intent.name.trim()
        )
          return fail('请完善每个意图名称');
        ids.add(intent.id);
      }
      break;
    }
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
      const mismatchMessage = getWorkflowBindingTypeMismatchMessage(
        name,
        value,
        bindingTypes[name] as WorkflowVariableOption['type'] | undefined,
        options,
      );
      if (mismatchMessage) {
        const bindingLabel = data.nodeType === 'end' ? '输出' : '输入';
        return fail(`${bindingLabel}${mismatchMessage}`);
      }
    }
  }
  if (
    validateReferences &&
    valuesWithReferences(data).some(
      (value) => getInvalidWorkflowVariableTokens(value, options).length > 0,
    )
  )
    return fail(INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE);
  return null;
}

export function getInvalidWorkflowVariableReferenceErrors(
  nodes: Node[],
  edges: Edge[] = [],
): ValidationError[] {
  return nodes.flatMap((node) => {
    const data = node.data as unknown as WorkflowNodeData;
    const options = getUpstreamWorkflowVariables(nodes, edges, node.id);
    const hasInvalidReference = valuesWithReferences(data).some(
      (value) => getInvalidWorkflowVariableTokens(value, options).length > 0,
    );

    return hasInvalidReference
      ? [workflowError(INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE, node)]
      : [];
  });
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
  const branchHandles = new Map<string, Map<string, number>>();
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
    if (sourceData.nodeType === 'condition' || sourceData.nodeType === 'intent') {
      const allowedHandles =
        sourceData.nodeType === 'condition'
          ? new Set(['true', 'false'])
          : new Set(intentOutputHandles(sourceData.config || {}));
      if (!allowedHandles.has(edge.sourceHandle || '')) {
        errors.push(workflowError('分流出口无效', source));
        continue;
      }
      const counts = branchHandles.get(source.id) || new Map<string, number>();
      counts.set(edge.sourceHandle || '', (counts.get(edge.sourceHandle || '') || 0) + 1);
      branchHandles.set(source.id, counts);
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
      const counts = branchHandles.get(node.id) || new Map<string, number>();
      if (counts.get('true') !== 1 || counts.get('false') !== 1) {
        errors.push(workflowError('必须各有一条 true / false 连线', node));
      }
    }
    if (data.nodeType === 'intent') {
      const counts = branchHandles.get(node.id) || new Map<string, number>();
      if (intentOutputHandles(data.config || {}).some((handle) => counts.get(handle) !== 1)) {
        errors.push(workflowError('每个意图和其他出口都必须各有一条连线', node));
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
