import type { Edge, Node } from '@xyflow/react';
import { normalizePhaseOneStartInputs } from './types';

export function normalizeWorkflowEdges(edges: Edge[]): Edge[] {
  return edges.map((edge, index) => {
    const sourceHandle = edge.sourceHandle || 'output';
    const targetHandleKey = edge.targetHandle || 'default-target';
    return {
      ...edge,
      id: edge.id || `${edge.source}-${sourceHandle}-${edge.target}-${targetHandleKey}-${index}`,
      sourceHandle,
    };
  });
}

export function serializeWorkflowGraph(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({
    schemaVersion: 2,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: (node.data as { nodeType: string }).nodeType,
      config:
        (node.data as { nodeType: string }).nodeType === 'start'
          ? {
              inputs: normalizePhaseOneStartInputs(
                (node.data as { config?: { inputs?: unknown } }).config?.inputs,
              ),
            }
          : (node.data as { config?: Record<string, unknown> }).config || {},
      position: node.position,
      data: node.data,
    })),
    edges: normalizeWorkflowEdges(edges).map(
      ({ id, source, sourceHandle, target, targetHandle }) => ({
        id,
        source,
        sourceHandle,
        target,
        targetHandle,
      }),
    ),
  });
}
