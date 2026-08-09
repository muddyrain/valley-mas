import { describe, expect, it } from 'vitest';
import {
  ENABLED_TEMPLATE_COUNT,
  ENABLED_TEMPLATE_IDS,
  getWorkflowTemplate,
  isTemplateSupported,
  TOTAL_TEMPLATE_COUNT,
  WORKFLOW_TEMPLATE_DEFS,
} from './workflowTemplates';

describe('workflow template catalog', () => {
  it('keeps catalog counts and enabled IDs in sync', () => {
    expect(TOTAL_TEMPLATE_COUNT).toBe(WORKFLOW_TEMPLATE_DEFS.length);
    expect(ENABLED_TEMPLATE_COUNT).toBe(ENABLED_TEMPLATE_IDS.size);
    expect(ENABLED_TEMPLATE_COUNT).toBeGreaterThan(0);
  });

  it('resolves only supported templates', () => {
    expect(getWorkflowTemplate('blog-import')?.name).toBe('博客导入工作流');
    expect(getWorkflowTemplate('missing')).toBeUndefined();
    expect(isTemplateSupported('content-generate')).toBe(true);
    expect(isTemplateSupported(null)).toBe(false);
  });
});
