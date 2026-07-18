import type { Edge, Node } from '@xyflow/react';
import { normalizeStartInputs, type WorkflowNodeData } from './types';

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
  return JSON.stringify({
    schemaVersion: 4,
    nodes: nodes.map((node) => {
      const data = node.data as unknown as WorkflowNodeData;
      return {
        id: node.id,
        type: data.nodeType,
        label: data.label,
        position: node.position,
        config:
          data.nodeType === 'start'
            ? { inputs: normalizeStartInputs(data.config?.inputs) }
            : data.config || {},
        ...(data.when ? { when: data.when } : {}),
      };
    }),
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
