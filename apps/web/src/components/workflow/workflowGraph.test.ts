import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  expandLoopCanvas,
  loopBodyChildID,
  loopBodyChildPosition,
  loopBodyDimensions,
  loopBodyExitID,
  loopBodyHeight,
  loopBodyID,
  loopBodyWidth,
  normalizeWorkflowEdges,
  serializeWorkflowGraph,
} from './workflowGraph';

function node(
  id: string,
  nodeType: string,
  config: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: nodeType,
    position: { x: 10, y: 20 },
    data: { label: id, nodeType, config, ...extra },
  };
}

describe('workflow graph geometry', () => {
  it('keeps loop containers large enough and centers their children', () => {
    expect(loopBodyWidth(0)).toBe(560);
    expect(loopBodyWidth(2)).toBe(736);
    expect(loopBodyHeight(10)).toBe(330);
    expect(loopBodyChildPosition(0, 2)).toEqual({ x: 64, y: 104 });
    expect(loopBodyChildPosition(1, 2)).toEqual({ x: 408, y: 104 });
    expect(
      loopBodyDimensions([{ id: 'child', position: { x: 700, y: 400 }, data: {} } as Node]),
    ).toEqual({ width: 1028, height: 608 });
    expect(loopBodyID('loop')).toBe('loop::loop-body');
    expect(loopBodyExitID('loop')).toBe('loop::loop-exit');
    expect(loopBodyChildID('loop', 'writer')).toBe('loop::loop-node::writer');
  });
});

describe('workflow graph persistence', () => {
  it('normalizes missing edge IDs, handles, and renderer type without mutating endpoints', () => {
    expect(
      normalizeWorkflowEdges([
        { id: '', source: 'a', target: 'b' },
        {
          id: 'custom',
          source: 'b',
          sourceHandle: 'true',
          target: 'c',
          targetHandle: 'custom-input',
          type: 'custom',
        },
      ]),
    ).toEqual([
      {
        id: 'a-output-b-input-0',
        source: 'a',
        sourceHandle: 'output',
        target: 'b',
        targetHandle: 'input',
        type: 'insertable',
      },
      {
        id: 'custom',
        source: 'b',
        sourceHandle: 'true',
        target: 'c',
        targetHandle: 'custom-input',
        type: 'custom',
      },
    ]);
  });

  it('serializes only persisted outer nodes and normalizes start-input contracts', () => {
    const nodes = [
      node('start', 'start', {
        inputs: { tagIds: { type: 'array', required: true } },
        ignored: 'not persisted for start',
      }),
      node(
        'end',
        'end',
        { outputs: {} },
        {
          when: { left: '{{start.output.tagIds}}', operator: 'isEmpty' },
        },
      ),
      node('virtual', 'loopBody', {}, { isLoopBody: true, loopParentId: 'loop' }),
    ];
    const graph = JSON.parse(
      serializeWorkflowGraph(nodes, [{ id: '', source: 'start', target: 'end' }]),
    );

    expect(graph.schemaVersion).toBe(4);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.nodes[0].config).toEqual({
      inputs: {
        tagIds: {
          type: 'string[]',
          required: true,
          control: 'blog_tags',
          provider: 'blog.tags',
        },
      },
    });
    expect(graph.nodes[1].when).toEqual({
      left: '{{start.output.tagIds}}',
      operator: 'isEmpty',
    });
    expect(graph.edges).toEqual([
      {
        id: 'start-output-end-input-0',
        source: 'start',
        sourceHandle: 'output',
        target: 'end',
        targetHandle: 'input',
      },
    ]);
  });

  it('expands loop sentinels for the canvas and serializes them back deterministically', () => {
    const loop = node('loop', 'loop', {
      mode: 'count',
      count: 2,
      bodyPosition: { x: 40, y: 300 },
      body: {
        nodes: [
          {
            id: 'writer',
            type: 'template',
            label: 'Writer',
            position: { x: 1, y: 2 },
            config: { template: 'Hello' },
          },
        ],
        edges: [
          { id: 'entry', source: '__loop_entry__', target: 'writer' },
          { id: 'exit', source: 'writer', target: '__loop_exit__' },
        ],
      },
    });

    const expanded = expandLoopCanvas([loop], []);
    const body = expanded.nodes.find((item) => item.id === loopBodyID('loop'));
    const child = expanded.nodes.find((item) => item.id === loopBodyChildID('loop', 'writer'));
    const exit = expanded.nodes.find((item) => item.id === loopBodyExitID('loop'));

    expect(body).toMatchObject({ position: { x: 40, y: 300 }, data: { nodeCount: 1 } });
    expect(child).toMatchObject({
      parentId: loopBodyID('loop'),
      position: { x: 64, y: 104 },
      expandParent: false,
      data: { loopParentId: 'loop', loopBodyNodeId: 'writer' },
    });
    expect(exit?.parentId).toBe(loopBodyID('loop'));
    expect(expanded.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: loopBodyID('loop'),
          target: loopBodyChildID('loop', 'writer'),
        }),
        expect.objectContaining({
          source: loopBodyChildID('loop', 'writer'),
          target: loopBodyExitID('loop'),
        }),
      ]),
    );

    if (child) {
      child.data = {
        ...child.data,
        config: { template: '{{loop::loop-node::writer.output.text}}' },
      };
    }
    const serialized = JSON.parse(serializeWorkflowGraph(expanded.nodes, expanded.edges));
    expect(serialized.nodes).toHaveLength(1);
    expect(serialized.nodes[0].config.body.nodes[0]).toMatchObject({
      id: 'writer',
      type: 'template',
      config: { template: '{{writer.output.text}}' },
    });
    expect(serialized.nodes[0].config.body.edges).toEqual([
      expect.objectContaining({ source: '__loop_entry__', target: 'writer' }),
      expect.objectContaining({ source: 'writer', target: '__loop_exit__' }),
    ]);

    const expandedAgain = expandLoopCanvas(expanded.nodes, expanded.edges);
    expect(expandedAgain.nodes).toHaveLength(expanded.nodes.length);
    expect(expandedAgain.edges).toHaveLength(expanded.edges.length);
  });

  it('ignores malformed loop-body nodes and edges instead of leaking invalid canvas records', () => {
    const loop = node('loop', 'loop', {
      mode: 'count',
      count: 1,
      body: { nodes: [null, { id: 1, type: 'template' }], edges: [null, { source: 1, target: 2 }] },
    });
    const expanded = expandLoopCanvas([loop], []);

    expect(expanded.nodes).toHaveLength(3);
    expect(expanded.edges).toHaveLength(1);
  });
});
