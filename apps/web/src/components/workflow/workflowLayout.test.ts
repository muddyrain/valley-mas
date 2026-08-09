import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  layoutNodeInsertion,
  layoutWorkflowNodes,
  WORKFLOW_NODE_GAP,
  WORKFLOW_NODE_WIDTH,
} from './workflowLayout';

function node(
  id: string,
  x: number,
  y: number,
  nodeType = 'template',
  extra: Record<string, unknown> = {},
): Node {
  return {
    id,
    type: nodeType,
    position: { x, y },
    data: { label: id, nodeType, config: {}, ...extra },
  };
}

function edge(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target };
}

describe('layoutWorkflowNodes', () => {
  it('lays out an outer workflow left-to-right with stable margins and no input mutation', () => {
    const nodes = [
      node('start', 999, 999, 'start'),
      node('middle', -50, -50),
      node('end', 0, 0, 'end'),
    ];
    const result = layoutWorkflowNodes(nodes, [edge('start', 'middle'), edge('middle', 'end')]);

    expect(result.map((item) => item.position.x)).toEqual([
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
    ]);
    expect(result[0].position.x).toBeLessThan(result[1].position.x);
    expect(result[1].position.x).toBeLessThan(result[2].position.x);
    expect(Math.min(...result.map((item) => item.position.x))).toBe(80);
    expect(Math.min(...result.map((item) => item.position.y))).toBe(80);
    expect(nodes[0].position).toEqual({ x: 999, y: 999 });
    expect(layoutWorkflowNodes([], [])).toEqual([]);
  });

  it('keeps loop children inside the body and persists the body position on the loop', () => {
    const nodes = [
      node('loop', 0, 0, 'loop'),
      {
        ...node('loop::loop-body', 0, 250, 'loopBody', { isLoopBody: true, loopParentId: 'loop' }),
        style: { width: 560, height: 330 },
      },
      {
        ...node('child', 0, 0, 'template', { loopParentId: 'loop' }),
        parentId: 'loop::loop-body',
      },
      {
        ...node('exit', 559, 165, 'loopBodyExit', { isLoopBodyExit: true, loopParentId: 'loop' }),
        parentId: 'loop::loop-body',
      },
    ];
    const result = layoutWorkflowNodes(nodes, []);
    const loop = result.find((item) => item.id === 'loop');
    const body = result.find((item) => item.id === 'loop::loop-body');
    const child = result.find((item) => item.id === 'child');
    const exit = result.find((item) => item.id === 'exit');

    expect(body?.position).toEqual({ x: loop?.position.x, y: (loop?.position.y || 0) + 250 });
    expect(loop?.data.config).toMatchObject({ bodyPosition: body?.position });
    expect(child?.position.x).toBeGreaterThanOrEqual(64);
    expect(child?.position.y).toBeGreaterThanOrEqual(104);
    expect(exit?.position.x).toBe((body?.style?.width as number) - 1);
  });
});

describe('layoutNodeInsertion', () => {
  const step = WORKFLOW_NODE_WIDTH + WORKFLOW_NODE_GAP;

  it('appends after a source when no target is provided', () => {
    const nodes = [node('source', 10, 20)];
    expect(layoutNodeInsertion(nodes, [], 'source')).toEqual({
      nodes,
      position: { x: 10 + step, y: 20 },
    });
  });

  it('shifts the complete downstream branch when the gap is too small', () => {
    const nodes = [
      node('source', 0, 0),
      node('target', 300, 100),
      node('after', 700, 200),
      node('unrelated', 300, 500),
    ];
    const result = layoutNodeInsertion(nodes, [edge('target', 'after')], 'source', 'target');

    expect(result?.position).toEqual({ x: step, y: 50 });
    expect(result?.nodes.find((item) => item.id === 'target')?.position.x).toBe(step * 2);
    expect(result?.nodes.find((item) => item.id === 'after')?.position.x).toBe(
      700 + (step * 2 - 300),
    );
    expect(result?.nodes.find((item) => item.id === 'unrelated')?.position.x).toBe(300);
  });

  it('uses the midpoint when there is enough space or the target is behind the source', () => {
    const forward = layoutNodeInsertion(
      [node('source', 0, 0), node('target', 1000, 100)],
      [],
      'source',
      'target',
    );
    expect(forward?.position).toEqual({ x: 500, y: 50 });

    const backward = layoutNodeInsertion(
      [node('source', 500, 100), node('target', 100, 300)],
      [],
      'source',
      'target',
    );
    expect(backward?.position).toEqual({ x: 300, y: 200 });
  });

  it('returns null when either endpoint is absent', () => {
    expect(layoutNodeInsertion([], [], 'missing')).toBeNull();
    expect(layoutNodeInsertion([node('source', 0, 0)], [], 'source', 'missing')).toBeNull();
  });
});
