import { describe, expect, it } from 'vitest';
import { getWorkflowSideEffectLabel } from './workflowSideEffects';

describe('getWorkflowSideEffectLabel', () => {
  it.each([
    ['none', null],
    ['read', '只读'],
    ['model', 'AI 调用'],
    ['write', '写入'],
    ['model_and_storage', 'AI + 存储'],
    ['unknown', null],
    [null, null],
  ])('maps %s to %s', (sideEffect, expected) => {
    expect(getWorkflowSideEffectLabel(sideEffect)).toBe(expected);
  });
});
