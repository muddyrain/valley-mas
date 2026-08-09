import type { Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { getWorkflowAlignment } from './workflowAlignment';

function node(id: string, x: number, y: number, width = 100, height = 60): Node {
  return { id, position: { x, y }, width, height, data: {} };
}

describe('getWorkflowAlignment', () => {
  it('snaps center anchors before equally close edges and returns both guides', () => {
    const dragged = node('dragged', 54, 54);
    const other = node('other', 50, 50);
    const alignment = getWorkflowAlignment(dragged, [dragged, other], 1);

    expect(alignment.position).toEqual({ x: 50, y: 50 });
    expect(alignment.vertical).toEqual({ position: 100, start: 26, end: 134 });
    expect(alignment.horizontal).toEqual({ position: 80, start: 26, end: 174 });
  });

  it('scales the snap threshold with zoom and falls back to workflow dimensions', () => {
    const dragged: Node = { id: 'dragged', position: { x: 9, y: 500 }, data: {} };
    const other: Node = { id: 'other', position: { x: 0, y: 0 }, data: {} };

    expect(getWorkflowAlignment(dragged, [dragged, other], 2).vertical).toBeUndefined();
    expect(getWorkflowAlignment(dragged, [dragged, other], 0.5).position.x).toBe(0);
  });

  it('returns the original position when no anchor is nearby', () => {
    const dragged = node('dragged', 500, 500);
    expect(getWorkflowAlignment(dragged, [dragged, node('other', 0, 0)], 1)).toEqual({
      position: { x: 500, y: 500 },
      vertical: undefined,
      horizontal: undefined,
    });
  });
});
