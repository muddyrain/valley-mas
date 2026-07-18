import type { Node, XYPosition } from '@xyflow/react';
import { WORKFLOW_NODE_HEIGHT, WORKFLOW_NODE_WIDTH } from './workflowLayout';

const ALIGNMENT_THRESHOLD_PX = 8;
const GUIDE_PADDING = 24;

export interface WorkflowAlignmentGuide {
  position: number;
  start: number;
  end: number;
}

export interface WorkflowAlignment {
  position: XYPosition;
  vertical?: WorkflowAlignmentGuide;
  horizontal?: WorkflowAlignmentGuide;
}

interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AxisMatch {
  delta: number;
  coordinate: number;
  other: NodeBounds;
  distance: number;
  priority: number;
}

function nodeBounds(node: Node): NodeBounds {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width || node.width || WORKFLOW_NODE_WIDTH,
    height: node.measured?.height || node.height || WORKFLOW_NODE_HEIGHT,
  };
}

function axisAnchors(start: number, size: number) {
  return [
    { value: start, priority: 1 },
    { value: start + size / 2, priority: 0 },
    { value: start + size, priority: 1 },
  ];
}

function findAxisMatch(
  draggedStart: number,
  draggedSize: number,
  otherNodes: NodeBounds[],
  axis: 'x' | 'y',
  threshold: number,
): AxisMatch | undefined {
  const draggedAnchors = axisAnchors(draggedStart, draggedSize);
  let closest: AxisMatch | undefined;

  for (const other of otherNodes) {
    const otherStart = axis === 'x' ? other.x : other.y;
    const otherSize = axis === 'x' ? other.width : other.height;
    for (const dragged of draggedAnchors) {
      for (const candidate of axisAnchors(otherStart, otherSize)) {
        const delta = candidate.value - dragged.value;
        const distance = Math.abs(delta);
        if (distance > threshold) continue;

        const next = {
          delta,
          coordinate: candidate.value,
          other,
          distance,
          priority: dragged.priority + candidate.priority,
        };
        if (
          !closest ||
          next.priority < closest.priority ||
          (next.priority === closest.priority && next.distance < closest.distance)
        ) {
          closest = next;
        }
      }
    }
  }

  return closest;
}

/**
 * Finds nearby left/center/right and top/center/bottom anchors in flow coordinates.
 * The threshold is expressed in screen pixels so alignment feels unchanged across zoom levels.
 */
export function getWorkflowAlignment(
  draggedNode: Node,
  nodes: Node[],
  zoom: number,
): WorkflowAlignment {
  const dragged = nodeBounds(draggedNode);
  const others = nodes.filter((node) => node.id !== draggedNode.id).map(nodeBounds);
  const threshold = ALIGNMENT_THRESHOLD_PX / Math.max(zoom, 0.1);
  const verticalMatch = findAxisMatch(dragged.x, dragged.width, others, 'x', threshold);
  const horizontalMatch = findAxisMatch(dragged.y, dragged.height, others, 'y', threshold);
  const position = {
    x: dragged.x + (verticalMatch?.delta || 0),
    y: dragged.y + (horizontalMatch?.delta || 0),
  };

  return {
    position,
    vertical: verticalMatch
      ? {
          position: verticalMatch.coordinate,
          start: Math.min(position.y, verticalMatch.other.y) - GUIDE_PADDING,
          end:
            Math.max(
              position.y + dragged.height,
              verticalMatch.other.y + verticalMatch.other.height,
            ) + GUIDE_PADDING,
        }
      : undefined,
    horizontal: horizontalMatch
      ? {
          position: horizontalMatch.coordinate,
          start: Math.min(position.x, horizontalMatch.other.x) - GUIDE_PADDING,
          end:
            Math.max(
              position.x + dragged.width,
              horizontalMatch.other.x + horizontalMatch.other.width,
            ) + GUIDE_PADDING,
        }
      : undefined,
  };
}
