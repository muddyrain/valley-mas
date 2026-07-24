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
const loopBodyEntryID = '__loop_entry__';
const loopBodyExitID = '__loop_exit__';
const loopBodyMinWidth = 560;
const loopBodyNodeWidth = 264;
const loopBodyNodeHeight = 144;
const loopBodyNodeGap = 80;
const loopBodyHorizontalPadding = 64;
const loopBodyVerticalPadding = 64;
const loopBodyContentTop = 104;

export function loopBodyWidth(nodeCount: number) {
  const count = Math.max(1, nodeCount);
  return Math.max(
    loopBodyMinWidth,
    count * loopBodyNodeWidth + (count - 1) * loopBodyNodeGap + loopBodyHorizontalPadding * 2,
  );
}

export function loopBodyHeight(nodeCount: number) {
  void nodeCount;
  return 330;
}

export function loopBodyChildPosition(index: number, nodeCount: number) {
  const count = Math.max(1, nodeCount);
  const contentWidth = count * loopBodyNodeWidth + (count - 1) * loopBodyNodeGap;
  return {
    x: (loopBodyWidth(count) - contentWidth) / 2 + index * (loopBodyNodeWidth + loopBodyNodeGap),
    y: loopBodyContentTop,
  };
}

function constrainLoopBodyChildPosition(position: Node['position']): Node['position'] {
  return {
    x: Math.max(loopBodyHorizontalPadding, position.x),
    y: Math.max(loopBodyContentTop, position.y),
  };
}

export function loopBodyDimensions(nodes: Node[]) {
  return nodes.reduce(
    (dimensions, node) => ({
      width: Math.max(
        dimensions.width,
        node.position.x + loopBodyNodeWidth + loopBodyHorizontalPadding,
      ),
      height: Math.max(
        dimensions.height,
        node.position.y + loopBodyNodeHeight + loopBodyVerticalPadding,
      ),
    }),
    {
      width: loopBodyWidth(nodes.length),
      height: loopBodyHeight(nodes.length),
    },
  );
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

function normalizeLoopBodyReferences(value: unknown, loopID: string): unknown {
  const prefix = `${loopID}${loopBodyNodePrefix}`;
  if (typeof value === 'string') {
    const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const referencePattern = new RegExp(
      `\\{\\{\\s*${escapedPrefix}([^{}.\\s]+)\\.output\\.([^{}.\\s]+)\\s*\\}\\}`,
      'g',
    );
    return value.replace(
      referencePattern,
      (_, bodyNodeID: string, field: string) => `{{${bodyNodeID}.output.${field}}}`,
    );
  }
  if (Array.isArray(value)) return value.map((item) => normalizeLoopBodyReferences(item, loopID));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      normalizeLoopBodyReferences(item, loopID),
    ]),
  );
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
    const bodyNodes = nodes.filter(
      (candidate) => loopParentID(candidate) === node.id && !isLoopBodyNode(candidate),
    );
    const bodyEdges = edges.filter((edge) => {
      const source = nodeByID.get(edge.source);
      const target = nodeByID.get(edge.target);
      if (loopParentID(source) !== node.id || loopParentID(target) !== node.id) return false;
      if (!source || !target) return false;
      return !isLoopBodyNode(source) && !isLoopBodyNode(target);
    });
    const config =
      data.nodeType === 'loop'
        ? {
            ...(normalizeLoopBodyReferences(data.config || {}, node.id) as Record<string, unknown>),
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
        : parentLoopID
          ? (normalizeLoopBodyReferences(data.config || {}, parentLoopID) as Record<
              string,
              unknown
            >)
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
    const shouldHydrateBody = !existing.has(bodyID);
    if (shouldHydrateBody) {
      expandedNodes.push({
        id: bodyID,
        type: 'loopBody',
        position: {
          x: typeof bodyPosition?.x === 'number' ? bodyPosition.x : loop.position.x,
          y: typeof bodyPosition?.y === 'number' ? bodyPosition.y : loop.position.y + 250,
        },
        ...(loop.parentId ? { parentId: loop.parentId, extent: 'parent' as const } : {}),
        style: { width: loopBodyWidth(bodyNodes.length), height: loopBodyHeight(bodyNodes.length) },
        selectable: true,
        draggable: true,
        data: { isLoopBody: true, loopParentId: loop.id, nodeCount: bodyNodes.length },
      });
      expandedEdges.push({
        id: `${loop.id}::loop-body-link`,
        source: loop.id,
        sourceHandle: 'body',
        target: bodyID,
        targetHandle: 'loop-entry',
        type: 'loopBoundary',
        style: { stroke: 'hsl(var(--primary))', strokeWidth: 2.5 },
        selectable: false,
        focusable: false,
        deletable: false,
        data: { isLoopBodyLink: true },
      });
    }
    for (const raw of shouldHydrateBody ? bodyNodes : []) {
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
    for (const raw of shouldHydrateBody ? bodyEdges : []) {
      if (!raw || typeof raw !== 'object') continue;
      const edge = raw as {
        id?: unknown;
        source?: unknown;
        sourceHandle?: unknown;
        target?: unknown;
        targetHandle?: unknown;
      };
      if (typeof edge.source !== 'string' || typeof edge.target !== 'string') continue;
      const source =
        edge.source === loopBodyEntryID ? bodyID : loopBodyChildID(loop.id, edge.source);
      const target =
        edge.target === loopBodyExitID ? bodyID : loopBodyChildID(loop.id, edge.target);
      const isBoundaryEdge = source === bodyID || target === bodyID;
      const id =
        typeof edge.id === 'string'
          ? `${loop.id}${loopBodyNodePrefix}${edge.id}`
          : `${loop.id}${loopBodyNodePrefix}${edge.source}-${edge.target}`;
      if (expandedEdges.some((candidate) => candidate.id === id)) continue;
      expandedEdges.push({
        id,
        source,
        sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : 'output',
        target,
        targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : 'input',
        type: isBoundaryEdge ? 'loopBoundary' : 'insertable',
        ...(isBoundaryEdge
          ? { data: { isLoopBodyBoundary: true }, selectable: true, deletable: true }
          : {}),
      });
    }

    const directBodyNodes = expandedNodes.filter(
      (candidate) => loopParentID(candidate) === loop.id && !isLoopBodyNode(candidate),
    );
    const constrainedBodyNodes = directBodyNodes.map((candidate) => ({
      ...candidate,
      expandParent: false,
      position: constrainLoopBodyChildPosition(candidate.position),
    }));
    const constrainedNodesByID = new Map(
      constrainedBodyNodes.map((candidate) => [candidate.id, candidate]),
    );
    for (let bodyNodeIndex = 0; bodyNodeIndex < expandedNodes.length; bodyNodeIndex += 1) {
      const candidate = expandedNodes[bodyNodeIndex];
      const constrainedNode = constrainedNodesByID.get(candidate.id);
      if (constrainedNode) expandedNodes[bodyNodeIndex] = constrainedNode;
    }
    const bodyIndex = expandedNodes.findIndex((candidate) => candidate.id === bodyID);
    if (bodyIndex !== -1) {
      const loopBody = expandedNodes[bodyIndex];
      const dimensions = loopBodyDimensions(constrainedBodyNodes);
      expandedNodes[bodyIndex] = {
        ...loopBody,
        data: { ...loopBody.data, nodeCount: constrainedBodyNodes.length },
        style: {
          ...loopBody.style,
          ...dimensions,
        },
      };
    }
    const loopIndex = expandedNodes.findIndex((candidate) => candidate.id === loop.id);
    if (loopIndex !== -1) {
      const loopNode = expandedNodes[loopIndex];
      expandedNodes[loopIndex] = {
        ...loopNode,
        data: { ...loopNode.data, loopBodyNodeCount: constrainedBodyNodes.length },
      };
    }
  }
  return { nodes: expandedNodes, edges: expandedEdges };
}
