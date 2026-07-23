import type { Edge, Node } from '@xyflow/react';
import { normalizeStartInputs, type WorkflowNodeData } from './types';

type SerializedWorkflowNode = {
  id: string;
  type: WorkflowNodeData['nodeType'];
  label: string;
  position: Node['position'];
  config: Record<string, unknown>;
  when?: WorkflowNodeData['when'];
};

const loopBodySuffix = '::loop-body';
const loopBodyNodePrefix = '::loop-node::';

export function loopBodyHeight(nodeCount: number) {
  return Math.max(330, 120 + Math.ceil(Math.max(1, nodeCount) / 2) * 126);
}

export function loopBodyID(loopID: string) {
  return `${loopID}${loopBodySuffix}`;
}

export function loopBodyChildID(loopID: string, bodyNodeID: string) {
  return `${loopID}${loopBodyNodePrefix}${bodyNodeID}`;
}

function bodyNodeIDFromCanvasID(loopID: string, canvasID: string) {
  return canvasID.slice(`${loopID}${loopBodyNodePrefix}`.length);
}

function isLoopBodyNode(node: Node) {
  return (node.data as unknown as WorkflowNodeData).isLoopBody === true;
}

function loopParentID(node: Node | undefined) {
  if (!node) return undefined;
  return (node.data as unknown as WorkflowNodeData).loopParentId;
}

export function normalizeWorkflowEdges(edges: Edge[]): Edge[] {
  return edges.map((edge, index) => ({
    ...edge,
    type: edge.type || 'insertable',
    id:
      edge.id ||
      `${edge.source}-${edge.sourceHandle || 'output'}-${edge.target}-${edge.targetHandle || 'input'}-${index}`,
    sourceHandle: edge.sourceHandle || 'output',
    targetHandle: edge.targetHandle || 'input',
  }));
}

export function serializeWorkflowGraph(nodes: Node[], edges: Edge[]): string {
  const outerNodes = nodes.filter((node) => !isLoopBodyNode(node) && !loopParentID(node));
  const outerNodeIDs = new Set(outerNodes.map((node) => node.id));
  const nodeByID = new Map(nodes.map((node) => [node.id, node]));

  const serializeNode = (node: Node, parentLoopID?: string): SerializedWorkflowNode => {
    const data = node.data as unknown as WorkflowNodeData;
    const bodyNodes = nodes.filter((candidate) => loopParentID(candidate) === node.id);
    const bodyEdges = edges.filter(
      (edge) =>
        loopParentID(nodeByID.get(edge.source)) === node.id &&
        loopParentID(nodeByID.get(edge.target)) === node.id,
    );
    const config =
      data.nodeType === 'loop'
        ? {
            ...(data.config || {}),
            body: {
              nodes: bodyNodes.map((bodyNode) => serializeNode(bodyNode, node.id)),
              edges: bodyEdges.map((edge) => ({
                id: edge.id,
                source: bodyNodeIDFromCanvasID(node.id, edge.source),
                sourceHandle: edge.sourceHandle,
                target: bodyNodeIDFromCanvasID(node.id, edge.target),
                targetHandle: edge.targetHandle,
              })),
            },
          }
        : data.config || {};

    return {
      id: parentLoopID ? bodyNodeIDFromCanvasID(parentLoopID, node.id) : node.id,
      type: data.nodeType,
      label: data.label,
      position: node.position,
      config:
        data.nodeType === 'start' ? { inputs: normalizeStartInputs(data.config?.inputs) } : config,
      ...(data.when ? { when: data.when } : {}),
    };
  };

  return JSON.stringify({
    schemaVersion: 4,
    nodes: outerNodes.map((node) => serializeNode(node)),
    edges: normalizeWorkflowEdges(
      edges.filter((edge) => outerNodeIDs.has(edge.source) && outerNodeIDs.has(edge.target)),
    ).map(({ id, source, sourceHandle, target, targetHandle }) => ({
      id,
      source,
      sourceHandle,
      target,
      targetHandle,
    })),
  });
}

export function expandLoopCanvas(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const existing = new Set(nodes.map((node) => node.id));
  const expandedNodes = [...nodes];
  const expandedEdges = [...edges];
  const pendingLoops = nodes.filter(
    (node) =>
      (node.data as unknown as WorkflowNodeData).nodeType === 'loop' &&
      !(node.data as unknown as WorkflowNodeData).isLoopBody,
  );

  for (let index = 0; index < pendingLoops.length; index += 1) {
    const loop = pendingLoops[index];
    const data = loop.data as unknown as WorkflowNodeData;
    if (data.nodeType !== 'loop' || data.isLoopBody) continue;
    const config = data.config || {};
    const body =
      config.body && typeof config.body === 'object'
        ? (config.body as { nodes?: unknown[]; edges?: unknown[] })
        : undefined;
    const bodyNodes = Array.isArray(body?.nodes) ? body.nodes : [];
    const bodyEdges = Array.isArray(body?.edges) ? body.edges : [];
    const bodyPosition =
      config.bodyPosition && typeof config.bodyPosition === 'object'
        ? (config.bodyPosition as { x?: unknown; y?: unknown })
        : undefined;
    const bodyID = loopBodyID(loop.id);
    if (!existing.has(bodyID)) {
      expandedNodes.push({
        id: bodyID,
        type: 'loopBody',
        position: {
          x: typeof bodyPosition?.x === 'number' ? bodyPosition.x : loop.position.x,
          y: typeof bodyPosition?.y === 'number' ? bodyPosition.y : loop.position.y + 250,
        },
        ...(loop.parentId ? { parentId: loop.parentId, extent: 'parent' as const } : {}),
        style: { width: 560, height: loopBodyHeight(bodyNodes.length) },
        selectable: false,
        draggable: true,
        data: { isLoopBody: true, loopParentId: loop.id, nodeCount: bodyNodes.length },
      });
      expandedEdges.push({
        id: `${loop.id}::loop-body-link`,
        source: loop.id,
        sourceHandle: 'body',
        target: bodyID,
        targetHandle: 'loop-entry',
        type: 'default',
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2.5 },
        selectable: false,
        focusable: false,
        deletable: false,
        data: { isLoopBodyLink: true },
      });
    }
    for (const raw of bodyNodes) {
      if (!raw || typeof raw !== 'object') continue;
      const item = raw as {
        id?: unknown;
        type?: unknown;
        label?: unknown;
        position?: { x?: unknown; y?: unknown };
        config?: Record<string, unknown>;
        when?: WorkflowNodeData['when'];
      };
      if (typeof item.id !== 'string' || typeof item.type !== 'string') continue;
      const id = loopBodyChildID(loop.id, item.id);
      if (existing.has(id)) continue;
      expandedNodes.push({
        id,
        type: item.type,
        parentId: bodyID,
        extent: 'parent',
        position: {
          x: typeof item.position?.x === 'number' ? item.position.x : 90,
          y: typeof item.position?.y === 'number' ? item.position.y : 88,
        },
        data: {
          label: typeof item.label === 'string' ? item.label : item.id,
          nodeType: item.type as WorkflowNodeData['nodeType'],
          config: item.config || {},
          when: item.when,
          loopParentId: loop.id,
          loopBodyNodeId: item.id,
        },
      });
      if (item.type === 'loop') {
        pendingLoops.push(expandedNodes[expandedNodes.length - 1]);
      }
    }
    for (const raw of bodyEdges) {
      if (!raw || typeof raw !== 'object') continue;
      const edge = raw as {
        id?: unknown;
        source?: unknown;
        sourceHandle?: unknown;
        target?: unknown;
        targetHandle?: unknown;
      };
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string') continue;
      const id =
        typeof edge.id === 'string'
          ? `${loop.id}${loopBodyNodePrefix}${edge.id}`
          : `${loop.id}${loopBodyNodePrefix}${edge.source}-${edge.target}`;
      if (expandedEdges.some((candidate) => candidate.id === id)) continue;
      expandedEdges.push({
        id,
        source: loopBodyChildID(loop.id, edge.source),
        sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : 'output',
        target: loopBodyChildID(loop.id, edge.target),
        targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : 'input',
        type: 'insertable',
      });
    }
  }
  return { nodes: expandedNodes, edges: expandedEdges };
}
