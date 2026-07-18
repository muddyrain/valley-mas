import type { Edge, Node } from '@xyflow/react';

export const WORKFLOW_NODE_WIDTH = 220;
export const WORKFLOW_NODE_GAP = 96;

interface InsertNodeLayout {
  nodes: Node[];
  position: { x: number; y: number };
}

function collectDownstreamNodeIDs(edges: Edge[], startNodeID: string): Set<string> {
  const downstream = new Set<string>();
  const pending = [startNodeID];

  while (pending.length > 0) {
    const nodeID = pending.shift();
    if (!nodeID || downstream.has(nodeID)) continue;
    downstream.add(nodeID);
    for (const edge of edges) {
      if (edge.source === nodeID) pending.push(edge.target);
    }
  }

  return downstream;
}

/** Keeps a newly inserted node on the edge and creates readable horizontal spacing. */
export function layoutNodeInsertion(
  nodes: Node[],
  edges: Edge[],
  sourceNodeID: string,
  targetNodeID?: string,
): InsertNodeLayout | null {
  const source = nodes.find((node) => node.id === sourceNodeID);
  if (!source) return null;

  const step = WORKFLOW_NODE_WIDTH + WORKFLOW_NODE_GAP;
  if (!targetNodeID) {
    return {
      nodes,
      position: { x: source.position.x + step, y: source.position.y },
    };
  }

  const target = nodes.find((node) => node.id === targetNodeID);
  if (!target) return null;

  const horizontalDistance = target.position.x - source.position.x;
  if (horizontalDistance <= 0) {
    return {
      nodes,
      position: {
        x: (source.position.x + target.position.x) / 2,
        y: (source.position.y + target.position.y) / 2,
      },
    };
  }

  const requiredDistance = step * 2;
  const shift = Math.max(0, requiredDistance - horizontalDistance);
  const downstream = shift > 0 ? collectDownstreamNodeIDs(edges, targetNodeID) : new Set<string>();
  const nextNodes =
    shift > 0
      ? nodes.map((node) =>
          downstream.has(node.id)
            ? { ...node, position: { ...node.position, x: node.position.x + shift } }
            : node,
        )
      : nodes;
  const nextTarget = nextNodes.find((node) => node.id === targetNodeID) || target;

  return {
    nodes: nextNodes,
    position: {
      x: shift > 0 ? source.position.x + step : (source.position.x + nextTarget.position.x) / 2,
      y: (source.position.y + nextTarget.position.y) / 2,
    },
  };
}
