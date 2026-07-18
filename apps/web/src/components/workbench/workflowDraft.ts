import type { Edge, Node } from '@xyflow/react';
import type { AIWorkflowDraft } from '@/api/workflow';
import { NODE_CONFIGS } from '@/components/workflow/nodeConfig';
import { normalizeWorkflowEdges } from '@/components/workflow/workflowGraph';

export function workflowDraftToEditorGraph(draft: AIWorkflowDraft) {
  return {
    schemaVersion: draft.graph.schemaVersion,
    nodes: draft.graph.nodes.map((node, index) => ({
      id: node.id,
      type: node.type,
      position: node.position || { x: 240 + index * 280, y: 220 },
      data: {
        label: node.label || NODE_CONFIGS[node.type]?.label || node.id,
        nodeType: node.type,
        config: node.config,
        when: node.when,
      },
    })),
    edges: draft.graph.edges.map((edge, index) => ({
      id: `${edge.source}-${edge.sourceHandle || 'output'}-${edge.target}-${index}`,
      ...edge,
      sourceHandle: edge.sourceHandle || 'output',
      targetHandle: edge.targetHandle || 'input',
    })),
  };
}

export function workflowDraftToCanvas(draft: AIWorkflowDraft): { nodes: Node[]; edges: Edge[] } {
  const graph = workflowDraftToEditorGraph(draft);
  return { nodes: graph.nodes as Node[], edges: normalizeWorkflowEdges(graph.edges as Edge[]) };
}

export function isAIWorkflowDraft(value: unknown): value is AIWorkflowDraft {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AIWorkflowDraft>;
  return (
    candidate.graph?.schemaVersion === 4 &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.graph.nodes) &&
    Array.isArray(candidate.graph.edges)
  );
}
