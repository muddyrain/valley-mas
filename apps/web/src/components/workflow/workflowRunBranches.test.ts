import { describe, expect, it } from 'vitest';
import { getWorkflowRunBranchHandle } from './workflowRunBranches';

describe('getWorkflowRunBranchHandle', () => {
  it.each([
    ['switch', { matchedCaseId: 'vip' }, 'case:vip'],
    ['switch', {}, 'default'],
    ['condition', { matched: true }, 'true'],
    ['condition', { matched: false }, 'false'],
    ['intent', { intentId: 'question' }, 'intent:question'],
    ['intent', {}, 'intent:other'],
    ['llm', { text: 'done' }, null],
    ['switch', undefined, null],
  ])('maps %s output %j to %s', (nodeType, output, expected) => {
    expect(getWorkflowRunBranchHandle(nodeType, output)).toBe(expected);
  });
});
