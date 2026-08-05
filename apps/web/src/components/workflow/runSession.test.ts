import { describe, expect, it } from 'vitest';
import { createWorkflowRunSession, workflowRunSessionReducer } from './runSession';

describe('workflowRunSessionReducer', () => {
  it('clears snapshots and ignores late events after the workflow graph changes', () => {
    const running = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 1,
      nodes: {
        oldNode: {
          status: 'success',
          output: { title: 'old graph result' },
        },
      },
    });

    const invalidated = workflowRunSessionReducer(running, { type: 'graphChanged' });

    expect(invalidated).toEqual({
      ...createWorkflowRunSession(),
      generation: 2,
    });

    const afterLateEvent = workflowRunSessionReducer(invalidated, {
      type: 'event',
      generation: 1,
      event: {
        step: 'oldNode',
        status: 'success',
        data: { runId: 'old-run', output: { title: 'late result' } },
      },
    });

    expect(afterLateEvent).toBe(invalidated);
  });
});
