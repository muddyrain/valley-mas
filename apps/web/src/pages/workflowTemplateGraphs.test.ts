import { describe, expect, it } from 'vitest';
import { validateWorkflowDraft } from '@/components/workflow/validateWorkflowConfig';
import { getWorkflowTemplateGraph } from './workflowTemplateGraphs';

describe('workflow template graphs', () => {
  it.each(['blog-import', 'content-generate'])('%s is a valid connected Graph v4 draft', (id) => {
    const graph = getWorkflowTemplateGraph(id);

    expect(graph?.schemaVersion).toBe(4);
    expect(graph?.nodes[0].data).toMatchObject({ nodeType: 'start' });
    expect(graph?.nodes.at(-1)?.data).toMatchObject({ nodeType: 'end' });
    expect(validateWorkflowDraft(graph?.nodes || [], graph?.edges || [])).toEqual([]);
  });

  it('returns a fresh clone and does not expose catalog mutation', () => {
    const first = getWorkflowTemplateGraph('blog-import');
    const second = getWorkflowTemplateGraph('blog-import');
    expect(first).not.toBe(second);
    expect(first?.nodes).not.toBe(second?.nodes);

    if (first) first.nodes[0].position.x = 9999;
    expect(getWorkflowTemplateGraph('blog-import')?.nodes[0].position.x).toBe(50);
    expect(getWorkflowTemplateGraph('missing')).toBeUndefined();
  });
});
