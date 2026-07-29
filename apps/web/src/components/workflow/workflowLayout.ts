import type { Edge, Node } from '@xyflow/react';
import dagre from 'dagre';
import type { WorkflowNodeData } from './types';

export const WORKFLOW_NODE_WIDTH = 264;
export const WORKFLOW_NODE_HEIGHT = 144;
export const WORKFLOW_NODE_GAP = 96;
const WORKFLOW_AUTO_LAYOUT_NODE_GAP = 144;
const WORKFLOW_LAYOUT_MARGIN = 80;
const WORKFLOW_NODE_VERTICAL_GAP = 80;
const LOOP_BODY_MIN_WIDTH = 560;
const LOOP_BODY_MIN_HEIGHT = 330;
const LOOP_BODY_HORIZONTAL_PADDING = 64;
const LOOP_BODY_CONTENT_TOP = 104;
const LOOP_BODY_VERTICAL_PADDING = 64;
const LOOP_BODY_OFFSET_Y = 250;

interface NodeDimensions {
  width: number;
  height: number;
}

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

function getNodeData(node: Node): WorkflowNodeData {
  return node.data as unknown as WorkflowNodeData;
}

function isLoopBodyNode(node: Node) {
  return getNodeData(node).isLoopBody === true;
}

function isLoopBodyExitNode(node: Node) {
  return getNodeData(node).isLoopBodyExit === true;
}

function nodeDimension(node: Node, dimension: 'width' | 'height', fallback: number) {
  const measured = node.measured?.[dimension];
  if (typeof measured === 'number' && measured > 0) return measured;
  const styled = node.style?.[dimension];
  const parsed = typeof styled === 'number' ? styled : Number.parseFloat(String(styled ?? ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function layoutScope(
  nodes: Node[],
  edges: Edge[],
  dimensionsByID = new Map<string, NodeDimensions>(),
): Map<string, Node['position']> {
  if (nodes.length === 0) return new Map();

  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: 'LR',
    ranker: 'network-simplex',
    acyclicer: 'greedy',
    ranksep: WORKFLOW_AUTO_LAYOUT_NODE_GAP,
    nodesep: WORKFLOW_NODE_VERTICAL_GAP,
    edgesep: 24,
    marginx: 0,
    marginy: 0,
  });

  const nodeIDs = new Set(nodes.map((node) => node.id));
  for (const node of nodes) {
    graph.setNode(
      node.id,
      dimensionsByID.get(node.id) || {
        width: nodeDimension(node, 'width', WORKFLOW_NODE_WIDTH),
        height: nodeDimension(node, 'height', WORKFLOW_NODE_HEIGHT),
      },
    );
  }
  for (const edge of edges) {
    if (!nodeIDs.has(edge.source) || !nodeIDs.has(edge.target)) continue;
    graph.setEdge(edge.source, edge.target, {}, edge.id);
  }

  dagre.layout(graph);

  let minimumX = Number.POSITIVE_INFINITY;
  let minimumY = Number.POSITIVE_INFINITY;
  const positions = new Map<string, Node['position']>();
  for (const node of nodes) {
    const layout = graph.node(node.id);
    const dimensions = dimensionsByID.get(node.id) || {
      width: nodeDimension(node, 'width', WORKFLOW_NODE_WIDTH),
      height: nodeDimension(node, 'height', WORKFLOW_NODE_HEIGHT),
    };
    const position = {
      x: layout.x - dimensions.width / 2,
      y: layout.y - dimensions.height / 2,
    };
    positions.set(node.id, position);
    minimumX = Math.min(minimumX, position.x);
    minimumY = Math.min(minimumY, position.y);
  }

  const offsetX = WORKFLOW_LAYOUT_MARGIN - minimumX;
  const offsetY = WORKFLOW_LAYOUT_MARGIN - minimumY;
  for (const [nodeID, position] of positions) {
    positions.set(nodeID, {
      x: Math.round(position.x + offsetX),
      y: Math.round(position.y + offsetY),
    });
  }
  return positions;
}

function scopeNodeDimensions(node: Node, nodes: Node[]): NodeDimensions {
  const dimensions = {
    width: nodeDimension(node, 'width', WORKFLOW_NODE_WIDTH),
    height: nodeDimension(node, 'height', WORKFLOW_NODE_HEIGHT),
  };
  if (getNodeData(node).nodeType !== 'loop' || isLoopBodyNode(node)) return dimensions;

  const body = nodes.find(
    (candidate) => isLoopBodyNode(candidate) && getNodeData(candidate).loopParentId === node.id,
  );
  if (!body) return dimensions;
  return {
    width: Math.max(dimensions.width, nodeDimension(body, 'width', LOOP_BODY_MIN_WIDTH)),
    height: LOOP_BODY_OFFSET_Y + nodeDimension(body, 'height', LOOP_BODY_MIN_HEIGHT),
  };
}

function scopeDimensions(nodes: Node[], allNodes: Node[]) {
  return new Map(nodes.map((node) => [node.id, scopeNodeDimensions(node, allNodes)]));
}

function loopDepth(loop: Node, nodeByID: Map<string, Node>) {
  let depth = 0;
  let parentID = getNodeData(loop).loopParentId;
  const visited = new Set<string>();
  while (parentID && !visited.has(parentID)) {
    visited.add(parentID);
    const parent = nodeByID.get(parentID);
    if (!parent) break;
    depth += 1;
    parentID = getNodeData(parent).loopParentId;
  }
  return depth;
}

function loopBodyDimensions(nodes: Node[]) {
  return nodes.reduce(
    (dimensions, node) => ({
      width: Math.max(
        dimensions.width,
        node.position.x +
          nodeDimension(node, 'width', WORKFLOW_NODE_WIDTH) +
          LOOP_BODY_HORIZONTAL_PADDING,
      ),
      height: Math.max(
        dimensions.height,
        node.position.y +
          nodeDimension(node, 'height', WORKFLOW_NODE_HEIGHT) +
          LOOP_BODY_VERTICAL_PADDING,
      ),
    }),
    { width: LOOP_BODY_MIN_WIDTH, height: LOOP_BODY_MIN_HEIGHT },
  );
}

/**
 * Arranges the persisted workflow from left to right while keeping loop-body
 * children inside their current parent containers.
 */
export function layoutWorkflowNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;

  let nextNodes = nodes.map((node) => ({ ...node, position: { ...node.position } }));
  const originalNodeByID = new Map(nodes.map((node) => [node.id, node]));
  const loops = nodes
    .filter((node) => getNodeData(node).nodeType === 'loop' && !isLoopBodyNode(node))
    .sort((a, b) => loopDepth(b, originalNodeByID) - loopDepth(a, originalNodeByID));

  for (const loop of loops) {
    const body = nextNodes.find(
      (node) => isLoopBodyNode(node) && getNodeData(node).loopParentId === loop.id,
    );
    if (!body) continue;

    const bodyChildren = nextNodes.filter((node) => {
      const data = getNodeData(node);
      return data.loopParentId === loop.id && !data.isLoopBody && !data.isLoopBodyExit;
    });
    const childPositions = layoutScope(
      bodyChildren,
      edges,
      scopeDimensions(bodyChildren, nextNodes),
    );
    const nestedBodyPositions = new Map<string, Node['position']>();

    nextNodes = nextNodes.map((node) => {
      const position = childPositions.get(node.id);
      if (!position) return node;
      const nextPosition = {
        x: position.x - WORKFLOW_LAYOUT_MARGIN + LOOP_BODY_HORIZONTAL_PADDING,
        y: position.y - WORKFLOW_LAYOUT_MARGIN + LOOP_BODY_CONTENT_TOP,
      };
      if (getNodeData(node).nodeType === 'loop') {
        nestedBodyPositions.set(node.id, {
          x: nextPosition.x,
          y: nextPosition.y + LOOP_BODY_OFFSET_Y,
        });
      }
      return { ...node, position: nextPosition };
    });

    if (nestedBodyPositions.size > 0) {
      nextNodes = nextNodes.map((node) => {
        if (!isLoopBodyNode(node)) return node;
        const position = nestedBodyPositions.get(getNodeData(node).loopParentId || '');
        return position ? { ...node, position } : node;
      });
    }

    const containedNodes = nextNodes.filter(
      (node) => node.parentId === body.id && !isLoopBodyExitNode(node),
    );
    const dimensions = loopBodyDimensions(containedNodes);
    nextNodes = nextNodes.map((node) => {
      if (node.id === body.id) {
        return { ...node, style: { ...node.style, ...dimensions } };
      }
      if (isLoopBodyExitNode(node) && getNodeData(node).loopParentId === loop.id) {
        return {
          ...node,
          position: { x: dimensions.width - 1, y: Math.round(dimensions.height / 2) },
        };
      }
      return node;
    });
  }

  const outerNodes = nextNodes.filter(
    (node) => !node.parentId && !isLoopBodyNode(node) && !isLoopBodyExitNode(node),
  );
  const outerPositions = layoutScope(outerNodes, edges, scopeDimensions(outerNodes, nextNodes));
  const rootLoopBodyPositions = new Map<string, Node['position']>();
  nextNodes = nextNodes.map((node) => {
    const position = outerPositions.get(node.id);
    if (!position) return node;
    if (getNodeData(node).nodeType === 'loop') {
      rootLoopBodyPositions.set(node.id, {
        x: position.x,
        y: position.y + LOOP_BODY_OFFSET_Y,
      });
    }
    return { ...node, position };
  });
  if (rootLoopBodyPositions.size > 0) {
    nextNodes = nextNodes.map((node) => {
      if (!isLoopBodyNode(node) || node.parentId) return node;
      const position = rootLoopBodyPositions.get(getNodeData(node).loopParentId || '');
      return position ? { ...node, position } : node;
    });
  }

  const bodyByLoopID = new Map(
    nextNodes.filter(isLoopBodyNode).map((node) => [getNodeData(node).loopParentId || '', node]),
  );
  return nextNodes.map((node) => {
    if (getNodeData(node).nodeType !== 'loop' || isLoopBodyNode(node)) return node;
    const bodyPosition = bodyByLoopID.get(node.id)?.position;
    if (!bodyPosition) return node;
    const data = getNodeData(node);
    return {
      ...node,
      data: {
        ...data,
        config: { ...data.config, bodyPosition },
      },
    };
  });
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
