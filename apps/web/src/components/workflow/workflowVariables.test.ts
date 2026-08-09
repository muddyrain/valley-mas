import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  getInvalidWorkflowVariableTokens,
  getLoopOutputVariables,
  getUpstreamWorkflowVariables,
  getWorkflowNodeOutputFields,
  getWorkflowVariableOption,
  migrateLLMPromptBindings,
  renameWorkflowNodeOutputReferences,
  splitWorkflowTemplate,
  workflowValueTypeLabel,
} from './workflowVariables';

function workflowNode(
  id: string,
  nodeType: string,
  config: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: nodeType,
    position: { x: 0, y: 0 },
    data: { label: id, nodeType, config, ...extra },
  };
}

function workflowEdge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe('workflow variable model', () => {
  it('derives typed output contracts for dynamic and built-in nodes', () => {
    expect(
      getWorkflowNodeOutputFields('start', {
        inputs: {
          topic: { type: 'string' },
          files: { type: 'array' },
          invalid: { type: 'date' },
        },
      }),
    ).toEqual([
      ['topic', 'string'],
      ['files', 'array'],
    ]);
    expect(
      getWorkflowNodeOutputFields('llm', {
        outputMode: 'json',
        outputSchema: { title: 'string', score: 'number' },
        errorHandling: { mode: 'continue' },
      }),
    ).toEqual([
      ['title', 'string'],
      ['score', 'number'],
      ['model', 'string'],
      ['tokenUsage', 'number'],
      ['_failed', 'boolean'],
      ['_error', 'string'],
      ['_errorCode', 'string'],
      ['_attempts', 'number'],
    ]);
    expect(
      getWorkflowNodeOutputFields('tool', { capabilityId: 'blog.createDraft' }),
    ).toContainEqual(['editPath', 'string']);
    expect(
      getWorkflowNodeOutputFields('merge', {
        fields: [
          { name: 'items', strategy: 'array', type: 'string' },
          { name: 'first', strategy: 'first', type: 'boolean' },
        ],
      }),
    ).toEqual([
      ['items', 'array'],
      ['first', 'boolean'],
    ]);
  });

  it('returns transitive upstream variables plus LLM-local bindings', () => {
    const nodes = [
      workflowNode('start', 'start', { inputs: { topic: { type: 'string' } } }),
      workflowNode('template', 'template', { template: '{{start.output.topic}}' }),
      workflowNode('unrelated', 'variable', {
        assignments: [{ name: 'ignored', type: 'number', value: 1 }],
      }),
      workflowNode('writer', 'llm', {
        prompt: '{{brief}}',
        inputs: { brief: '{{template.output.text}}' },
        inputTypes: { brief: 'string' },
      }),
    ];
    const options = getUpstreamWorkflowVariables(
      nodes,
      [workflowEdge('start', 'template'), workflowEdge('template', 'writer')],
      'writer',
    );

    expect(options[0]).toMatchObject({ token: '{{brief}}', type: 'string', scope: 'local' });
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: '{{start.output.topic}}', scope: 'upstream' }),
        expect.objectContaining({ token: '{{template.output.text}}', scope: 'upstream' }),
      ]),
    );
    expect(options.some((option) => option.nodeId === 'unrelated')).toBe(false);
    expect(getUpstreamWorkflowVariables(nodes, [], 'missing')).toEqual([]);
  });

  it('exposes loop locals and body outputs to loop aggregation', () => {
    const nodes = [
      workflowNode('loop', 'loop', {
        mode: 'array',
        middleVariables: [
          { name: 'total', type: 'number' },
          { name: '', type: 'string' },
        ],
      }),
      workflowNode('loop::loop-body', 'loopBody', {}, { isLoopBody: true, loopParentId: 'loop' }),
      workflowNode(
        'loop::loop-node::writer',
        'llm',
        {},
        { loopParentId: 'loop', loopBodyNodeId: 'writer' },
      ),
    ];

    expect(getLoopOutputVariables(nodes, 'loop')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ token: '{{item}}', scope: 'loop' }),
        expect.objectContaining({ token: '{{index}}', type: 'number' }),
        expect.objectContaining({ token: '{{total}}', type: 'number' }),
        expect.objectContaining({ token: '{{writer.output.text}}', type: 'string' }),
      ]),
    );
    expect(getLoopOutputVariables(nodes, 'missing')).toEqual([]);
  });

  it('renames matching references recursively without touching similar tokens', () => {
    const source = workflowNode('source', 'variable', {});
    const target = workflowNode(
      'target',
      'tool',
      {
        inputs: {
          direct: '{{ source.output.old }}',
          nested: ['prefix {{source.output.old}}', { same: '{{source.output.older}}' }],
        },
      },
      { when: { left: '{{source.output.old}}', operator: 'isEmpty' } },
    );
    const renamed = renameWorkflowNodeOutputReferences([source, target], 'source', 'old', 'new');

    expect(renamed[1].data).toMatchObject({
      config: {
        inputs: {
          direct: '{{source.output.new}}',
          nested: ['prefix {{source.output.new}}', { same: '{{source.output.older}}' }],
        },
      },
      when: { left: '{{source.output.new}}' },
    });
    expect(renameWorkflowNodeOutputReferences([source], 'source', 'same', 'same')).toEqual([
      source,
    ]);
  });

  it('migrates direct upstream LLM prompt references into typed local bindings', () => {
    const start = workflowNode('start', 'start', {
      inputs: { topic: { type: 'string' }, count: { type: 'number' } },
    });
    const writer = workflowNode('writer', 'llm', {
      systemPrompt: '主题：{{ start.output.topic }}',
      prompt: '{{start.output.topic}} / {{start.output.count}}',
      inputs: { topic: 'fixed' },
      inputTypes: { topic: 'string' },
    });
    const migrated = migrateLLMPromptBindings([start, writer], [workflowEdge('start', 'writer')]);
    const config = migrated[1].data.config as Record<string, Record<string, unknown> | string>;

    expect(config.systemPrompt).toBe('主题：{{start_topic}}');
    expect(config.prompt).toBe('{{start_topic}} / {{count}}');
    expect(config.inputs).toEqual({
      topic: 'fixed',
      start_topic: '{{start.output.topic}}',
      count: '{{start.output.count}}',
    });
    expect(config.inputTypes).toEqual({ topic: 'string', start_topic: 'string', count: 'number' });
  });

  it('splits valid tokens, preserves invalid drafts, and resolves legacy loop references', () => {
    const options = [
      {
        nodeId: 'writer',
        nodeLabel: 'Writer',
        field: 'text',
        type: 'string' as const,
        token: '{{writer.output.text}}',
      },
      {
        nodeId: 'loop',
        nodeLabel: 'Loop',
        field: 'index',
        type: 'number' as const,
        token: '{{index}}',
        scope: 'loop' as const,
      },
    ];

    expect(splitWorkflowTemplate('A {{writer.output.text}} B {{missing', options)).toEqual([
      { type: 'text', value: 'A ' },
      { type: 'variable', token: '{{writer.output.text}}', option: options[0] },
      { type: 'text', value: ' B ' },
      { type: 'text', value: '{{missing' },
    ]);
    expect(getWorkflowVariableOption('{{loop.loop.index}}', options)).toBe(options[1]);
    expect(
      getInvalidWorkflowVariableTokens('{{bad}} {{bad}} {{writer.output.text}}', options),
    ).toEqual(['{{bad}}']);
    expect(workflowValueTypeLabel('object')).toBe('对象');
    expect(workflowValueTypeLabel('unknown')).toBe('变量');
  });
});
