import { describe, expect, it } from 'vitest';
import type { WorkflowToolCapability } from '@/api/workflow';
import { validateToolCapabilityInputs } from './workflowToolInputValidation';

function capability(
  required: string[],
  properties: WorkflowToolCapability['inputSchema']['properties'],
): WorkflowToolCapability {
  return {
    id: 'tool.demo',
    name: '演示工具',
    description: '',
    category: 'tool',
    sideEffect: 'none',
    modelCost: 0,
    writeCost: 0,
    available: true,
    inputSchema: { required, properties },
    outputSchema: {},
    aiUsage: '',
  };
}

describe('validateToolCapabilityInputs', () => {
  it('reports missing, null, and whitespace-only required inputs with field labels', () => {
    const result = validateToolCapabilityInputs(
      capability(['title', 'content', 'count'], {
        title: { title: '标题' },
        content: {},
        count: {},
      }),
      { title: '   ', content: null, count: 0 },
    );

    expect(result).toEqual([
      { field: 'title', message: '必填输入“标题”不能为空' },
      { field: 'content', message: '必填输入“content”不能为空' },
    ]);
  });

  it('uses schema defaults and treats false, zero, and empty collections as present', () => {
    expect(
      validateToolCapabilityInputs(
        capability(['title', 'enabled', 'items'], {
          title: { default: '默认标题' },
          enabled: {},
          items: {},
        }),
        { enabled: false, items: [] },
      ),
    ).toEqual([]);
  });
});
