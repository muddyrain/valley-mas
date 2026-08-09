import { describe, expect, it } from 'vitest';
import type { AIWorkflowDraft } from '@/api/workflow';
import {
  isAIWorkflowDraft,
  workflowDraftToCanvas,
  workflowDraftToEditorGraph,
} from './workflowDraft';

const draft: AIWorkflowDraft = {
  name: '生成博客',
  description: '测试草稿',
  graph: {
    schemaVersion: 4,
    nodes: [
      { id: 'start', type: 'start', label: '', position: { x: 10, y: 20 }, config: {} },
      { id: 'end', type: 'end', label: '完成', position: undefined as never, config: {} },
    ],
    edges: [{ source: 'start', target: 'end' }],
  },
};

describe('AI workflow draft adapter', () => {
  it('converts AI drafts to editor nodes with labels, fallback positions, and normalized ports', () => {
    const graph = workflowDraftToEditorGraph(draft);

    expect(graph.nodes[0]).toMatchObject({
      id: 'start',
      type: 'start',
      position: { x: 10, y: 20 },
      data: { label: '开始', nodeType: 'start', config: {} },
    });
    expect(graph.nodes[1].position).toEqual({ x: 520, y: 220 });
    expect(graph.edges[0]).toEqual({
      id: 'start-output-end-0',
      source: 'start',
      sourceHandle: 'output',
      target: 'end',
      targetHandle: 'input',
    });

    expect(workflowDraftToCanvas(draft).edges[0].type).toBe('insertable');
  });

  it('recognizes only minimally valid Graph v4 AI drafts', () => {
    expect(isAIWorkflowDraft(draft)).toBe(true);
    expect(isAIWorkflowDraft({ ...draft, name: 1 })).toBe(false);
    expect(isAIWorkflowDraft({ ...draft, graph: { ...draft.graph, schemaVersion: 3 } })).toBe(
      false,
    );
    expect(isAIWorkflowDraft(null)).toBe(false);
  });
});
