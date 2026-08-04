import { describe, expect, it } from 'vitest';
import { parseWorkflowCollaborationDiff } from './workflowCollaboration';

describe('parseWorkflowCollaborationDiff', () => {
  it('normalizes persisted workflow result data for the result card', () => {
    expect(
      parseWorkflowCollaborationDiff(
        JSON.stringify({ added: ['cover'], updated: ['summary'], risks: ['试运行会写入数据'] }),
      ),
    ).toEqual({ added: ['cover'], updated: ['summary'], risks: ['试运行会写入数据'] });
  });

  it('does not expose malformed persisted data to the UI', () => {
    expect(parseWorkflowCollaborationDiff('{invalid')).toEqual({});
  });
});
