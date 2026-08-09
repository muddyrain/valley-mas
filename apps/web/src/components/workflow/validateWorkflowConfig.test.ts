import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import type { WorkflowToolCapability } from '@/api/workflow';
import type { WorkflowNodeData } from './types';
import {
  getInvalidWorkflowVariableReferenceErrors,
  getUnconfiguredNodeLabels,
  getWorkflowBindingTypeMismatchMessage,
  getWorkflowToolInputErrors,
  hasUnconfiguredNodes,
  INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE,
  validateSingleNode,
  validateWorkflowConfig,
  validateWorkflowDraft,
} from './validateWorkflowConfig';

function node(
  id: string,
  nodeType: string,
  config: Record<string, unknown> = {},
  extra: Partial<WorkflowNodeData> = {},
): Node {
  return {
    id,
    type: nodeType,
    position: { x: 0, y: 0 },
    data: { label: id, nodeType, config, ...extra },
  };
}

function edge(source: string, target: string, sourceHandle = 'output'): Edge {
  return { id: `${source}-${sourceHandle}-${target}`, source, sourceHandle, target };
}

function validData(nodeType: WorkflowNodeData['nodeType']): WorkflowNodeData {
  const configs: Partial<Record<WorkflowNodeData['nodeType'], Record<string, unknown>>> = {
    start: { inputs: {} },
    end: { outputs: {} },
    llm: { prompt: 'Write', inputs: {} },
    template: { template: 'Hello' },
    http: {
      method: 'GET',
      url: 'https://example.com',
      timeoutSeconds: 10,
      retryCount: 0,
      params: [],
      headers: [],
      bodyType: 'none',
    },
    tool: { capabilityId: 'tool.demo', inputs: {} },
    condition: { left: 'value', operator: 'equals' },
    switch: {
      value: 'kind',
      valueType: 'string',
      cases: [
        { id: 'first', label: 'First', value: 'a' },
        { id: 'second', label: 'Second', value: 'b' },
      ],
    },
    merge: { fields: [{ name: 'result', sources: ['a', 'b'], strategy: 'first' }] },
    variable: { assignments: [{ name: 'value', type: 'string', value: 'x' }] },
    subworkflow: { workflowId: 'workflow', versionId: 'version' },
    intent: { query: 'text', intents: [{ id: 'question', name: 'Question' }] },
    loop: { mode: 'count', count: 2, body: { nodes: [{}] }, outputs: [] },
    approval: { title: 'Confirm' },
    delay: { delayMs: 1000 },
  };
  return { label: nodeType, nodeType, config: configs[nodeType] || {} };
}

describe('validateSingleNode', () => {
  it.each([
    'start',
    'end',
    'llm',
    'template',
    'http',
    'tool',
    'condition',
    'switch',
    'merge',
    'variable',
    'subworkflow',
    'intent',
    'loop',
    'approval',
    'delay',
  ] as const)('accepts a minimally configured %s node', (nodeType) => {
    expect(validateSingleNode(validData(nodeType))).toBeNull();
  });

  it.each([
    [{ label: 'bad', nodeType: 'unknown', config: {} }, '未识别的 Graph v4 节点类型'],
    [{ ...validData('llm'), when: { left: '', operator: 'equals' } }, '请选择上游变量作为执行条件'],
    [
      { label: 'loop', nodeType: 'loop', config: { mode: 'array', body: { nodes: [{}] } } },
      '请选择循环数组',
    ],
    [
      { label: 'loop', nodeType: 'loop', config: { mode: 'count', count: 1, body: { nodes: [] } } },
      '循环体至少需要一个节点',
    ],
    [{ label: 'llm', nodeType: 'llm', config: { inputs: {} } }, '请填写用户提示词'],
    [
      { label: 'llm', nodeType: 'llm', config: { prompt: 'x', inputs: { topic: ' ' } } },
      '输入变量“topic”尚未绑定值',
    ],
    [{ label: 'template', nodeType: 'template', config: { template: ' ' } }, '请填写文本模板'],
    [{ label: 'http', nodeType: 'http', config: { method: 'TRACE' } }, '请选择 HTTP 请求方法'],
    [
      { ...validData('http'), config: { ...validData('http').config, timeoutSeconds: 61 } },
      '超时必须在 1 到 60 秒之间',
    ],
    [{ label: 'tool', nodeType: 'tool', config: {} }, '请选择工具并完成输入映射'],
    [
      {
        label: 'switch',
        nodeType: 'switch',
        config: { value: 'x', valueType: 'string', cases: [] },
      },
      '请设置 2 到 8 个分支',
    ],
    [
      { label: 'merge', nodeType: 'merge', config: { fields: [] } },
      '请完成聚合字段、策略和至少两个候选引用',
    ],
    [
      { label: 'variable', nodeType: 'variable', config: { assignments: [] } },
      '请至少添加一个命名变量',
    ],
    [{ label: 'sub', nodeType: 'subworkflow', config: {} }, '请选择已发布工作流版本'],
    [
      { label: 'intent', nodeType: 'intent', config: { query: 'x', intents: [] } },
      '请设置 1 到 10 个意图',
    ],
  ] as Array<
    [WorkflowNodeData, string]
  >)('reports the first actionable configuration error', (data, message) => {
    expect(validateSingleNode(data)?.message).toBe(message);
  });
});

describe('workflow graph validation', () => {
  it('accepts a connected acyclic workflow with valid variable bindings', () => {
    const nodes = [
      node('start', 'start', { inputs: { topic: { type: 'string', required: true } } }),
      node('template', 'template', { template: '{{start.output.topic}}' }),
      node('end', 'end', {
        outputs: { result: '{{template.output.text}}' },
        outputTypes: { result: 'string' },
      }),
    ];
    const edges = [edge('start', 'template'), edge('template', 'end')];

    expect(validateWorkflowDraft(nodes, edges)).toEqual([]);
    expect(hasUnconfiguredNodes([node('start-only', 'start'), node('end-only', 'end')])).toBe(
      false,
    );
  });

  it('reports missing boundaries, unreachable nodes, and cycles', () => {
    const nodes = [
      node('start', 'start'),
      node('orphan', 'template', { template: 'x' }),
      node('a', 'template', { template: 'a' }),
      node('b', 'template', { template: 'b' }),
    ];
    const errors = validateWorkflowDraft(nodes, [
      edge('start', 'a'),
      edge('a', 'b'),
      edge('b', 'a'),
    ]);

    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        '必须且只能有一个结束节点',
        '无法从开始节点到达',
        '无法到达结束节点',
        '工作流不能包含循环',
      ]),
    );
  });

  it('requires exactly one edge for every condition branch', () => {
    const nodes = [
      node('start', 'start'),
      node('condition', 'condition', { left: 'x', operator: 'equals' }),
      node('end', 'end'),
    ];
    expect(
      validateWorkflowDraft(nodes, [
        edge('start', 'condition'),
        edge('condition', 'end', 'maybe'),
      ]).map((error) => error.message),
    ).toEqual(expect.arrayContaining(['分流出口无效', '必须各有一条 true / false 连线']));

    expect(
      validateWorkflowDraft(nodes, [
        edge('start', 'condition'),
        edge('condition', 'end', 'true'),
        edge('condition', 'end', 'false'),
      ]),
    ).toEqual([]);
  });

  it('reports invalid variable references, declared type mismatches, and optional non-string outputs', () => {
    const nodes = [
      node('start', 'start', { inputs: { count: { type: 'number' } } }),
      node(
        'optional',
        'variable',
        { assignments: [{ name: 'score', type: 'number', value: 1 }] },
        {
          when: { left: '{{start.output.count}}', operator: 'greaterThan', right: 0 },
        },
      ),
      node('end', 'end', {
        outputs: {
          missing: '{{missing.output.value}}',
          score: '{{optional.output.score}}',
          count: '{{start.output.count}}',
        },
        outputTypes: { missing: 'string', score: 'number', count: 'string' },
      }),
    ];
    const edges = [edge('start', 'optional'), edge('optional', 'end')];
    const errors = validateWorkflowDraft(nodes, edges);

    expect(errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        '输出字段“count”声明为文本，但引用变量为数字',
        '“optional”可能跳过，只能直接映射到 string 结束输出。',
      ]),
    );
    expect(
      getInvalidWorkflowVariableReferenceErrors(nodes, edges).map((error) => error.message),
    ).toContain(INVALID_WORKFLOW_VARIABLE_REFERENCE_MESSAGE);
  });

  it('enforces the Graph v4 node limit and exposes unconfigured labels', () => {
    const nodes = Array.from({ length: 31 }, (_, index) =>
      node(`node-${index}`, 'template', { template: index === 0 ? '' : 'x' }),
    );
    const errors = validateWorkflowConfig(nodes);

    expect(errors[0].message).toBe('Graph v4 最多支持 30 个节点');
    expect(getUnconfiguredNodeLabels(nodes)).toContain('node-0');
    expect(hasUnconfiguredNodes(nodes)).toBe(true);
  });
});

describe('workflow capability validation', () => {
  const capability: WorkflowToolCapability = {
    id: 'tool.demo',
    name: 'Demo',
    description: '',
    category: 'tool',
    sideEffect: 'none',
    modelCost: 0,
    writeCost: 0,
    available: true,
    inputSchema: { required: ['title'], properties: { title: { title: '标题' } } },
    outputSchema: {},
    aiUsage: '',
    ui: { numberConfig: { key: 'limit', label: '数量', min: 1, max: 5, default: 3 } },
  };

  it('reports unavailable tools, required inputs, and numeric UI bounds', () => {
    const tool = node('tool', 'tool', { capabilityId: 'tool.demo', inputs: {}, limit: 8 });
    expect(getWorkflowToolInputErrors([tool], { toolCapabilities: [] })[0].message).toBe(
      '该工具能力当前不可用，请重新选择工具',
    );
    expect(getWorkflowToolInputErrors([tool], { toolCapabilities: [capability] })[0]).toMatchObject(
      {
        field: 'title',
        message: '必填输入“标题”不能为空',
      },
    );
    expect(
      validateSingleNode(tool.data as unknown as WorkflowNodeData, {
        toolCapabilities: [capability],
      })?.message,
    ).toBe('数量超出允许范围');
  });

  it('describes binding type mismatches only for known references', () => {
    const options = [
      {
        nodeId: 'start',
        nodeLabel: 'start',
        field: 'count',
        type: 'number' as const,
        token: '{{start.output.count}}',
      },
    ];
    expect(
      getWorkflowBindingTypeMismatchMessage('count', '{{start.output.count}}', 'string', options),
    ).toBe('字段“count”声明为文本，但引用变量为数字');
    expect(getWorkflowBindingTypeMismatchMessage('count', 'fixed', 'string', options)).toBeNull();
  });
});
