import { describe, expect, it } from 'vitest';
import { buildCopilotMessagePayload, type CopilotContext } from './workbenchCopilot';

const context: CopilotContext = {
  scope: 'workflow',
  targetId: 'workflow-1',
  draft: { name: '博客导入' },
  selectedNodeId: 'parse-markdown',
};

describe('buildCopilotMessagePayload', () => {
  it('includes the selected collaboration model', () => {
    expect(
      buildCopilotMessagePayload(context, '处理标题', 'session-1', ' 42 ', 'draft-hash'),
    ).toMatchObject({
      scope: 'workflow',
      targetId: 'workflow-1',
      sessionId: 'session-1',
      message: '处理标题',
      modelId: '42',
      context: { baseHash: 'draft-hash' },
    });
  });

  it('omits modelId so the server can use its default model', () => {
    expect(
      buildCopilotMessagePayload(context, '处理标题', 'session-1', '', 'draft-hash'),
    ).not.toHaveProperty('modelId');
  });
});
