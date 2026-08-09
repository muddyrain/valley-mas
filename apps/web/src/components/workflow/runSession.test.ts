import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkflowRunSession,
  workflowRunEventNodeID,
  workflowRunSessionReducer,
  workflowRunSnapshotsFromNodeRuns,
} from './runSession';

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('tracks one run ID and ignores events from a replaced run', () => {
    const begun = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 3,
    });
    const first = workflowRunSessionReducer(begun, {
      type: 'event',
      generation: 3,
      event: {
        step: 'writer',
        status: 'running',
        data: { runId: 'run-1', input: { topic: 'AI' } },
      },
    });
    const foreign = workflowRunSessionReducer(first, {
      type: 'event',
      generation: 3,
      event: {
        step: 'writer',
        status: 'success',
        data: { runId: 'run-2', output: { text: 'wrong run' } },
      },
    });

    expect(first.runId).toBe('run-1');
    expect(first.nodes.writer).toMatchObject({ status: 'running', input: { topic: 'AI' } });
    expect(foreign).toBe(first);
  });

  it('records waiting approval and resumes the node with a fresh timer', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(5000);
    let session = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 1,
    });
    session = workflowRunSessionReducer(session, {
      type: 'event',
      generation: 1,
      event: { step: 'approval', status: 'running', data: { runId: 'run' } },
    });
    session = workflowRunSessionReducer(session, {
      type: 'event',
      generation: 1,
      event: { step: 'approval', status: 'waiting_approval', data: { runId: 'run' } },
    });

    expect(session.status).toBe('waiting_approval');
    expect(session.nodes.approval).toMatchObject({ status: 'running', startedAt: 1000 });

    session = workflowRunSessionReducer(session, {
      type: 'event',
      generation: 1,
      event: {
        step: 'approval',
        status: 'success',
        data: { runId: 'run', output: { approved: true } },
      },
    });
    session = workflowRunSessionReducer(session, {
      type: 'event',
      generation: 1,
      event: { step: 'next', status: 'running', data: { runId: 'run' } },
    });
    expect(session.nodes.approval).toMatchObject({ status: 'success', output: { approved: true } });
    expect(session.nodes.next.startedAt).toBe(5000);
  });

  it('routes loop-body snapshots to deterministic child IDs and retains every iteration', () => {
    let session = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 1,
    });
    for (const loopIteration of [0, 1]) {
      session = workflowRunSessionReducer(session, {
        type: 'event',
        generation: 1,
        event: {
          step: 'loop',
          status: 'success',
          data: {
            runId: 'run',
            bodyNodeId: 'writer',
            loopIteration,
            loopDepth: 1,
            output: { text: `round-${loopIteration}` },
          },
        },
      });
    }

    const childID = 'loop::loop-node::writer';
    expect(
      workflowRunEventNodeID({ step: 'loop', status: 'running', data: { bodyNodeId: 'writer' } }),
    ).toBe(childID);
    expect(session.nodes[childID].iterations).toEqual({
      0: expect.objectContaining({ status: 'success', output: { text: 'round-0' } }),
      1: expect.objectContaining({ status: 'success', output: { text: 'round-1' } }),
    });
  });

  it('closes running nodes on transport error and preserves completed checkpoints', () => {
    const running = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 4,
      nodes: {
        done: { status: 'success', output: { value: 1 } },
        failed: { status: 'running' },
        interrupted: { status: 'running', errorCode: 'EXISTING_CODE' },
      },
    });
    const failed = workflowRunSessionReducer(running, {
      type: 'error',
      generation: 4,
      error: 'connection lost',
      failedNodeId: 'failed',
      failedNodeCode: 'AI_UPSTREAM_FAILED',
    });

    expect(failed).toMatchObject({
      status: 'error',
      error: 'connection lost',
      failedNodeId: 'failed',
      failedNodeCode: 'AI_UPSTREAM_FAILED',
    });
    expect(failed.nodes.done).toEqual(running.nodes.done);
    expect(failed.nodes.failed).toMatchObject({
      status: 'error',
      error: 'connection lost',
      errorCode: 'AI_UPSTREAM_FAILED',
    });
    expect(failed.nodes.interrupted.errorCode).toBe('EXISTING_CODE');
  });

  it('cancels the session and every running node without treating cancellation as failure', () => {
    const running = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 2,
      nodes: { writer: { status: 'running' } },
    });
    const cancelled = workflowRunSessionReducer(running, { type: 'cancelled', generation: 2 });

    expect(cancelled).toMatchObject({
      status: 'cancelled',
      error: null,
      failedNodeId: null,
      failedNodeCode: null,
    });
    expect(cancelled.nodes.writer).toMatchObject({
      status: 'cancelled',
      errorCode: 'WORKFLOW_CANCELLED',
    });
    expect(cancelled.nodes.writer.error).toBeUndefined();
  });

  it('applies terminal workflow events with final output and stable fallback errors', () => {
    const running = workflowRunSessionReducer(createWorkflowRunSession(), {
      type: 'begin',
      generation: 1,
    });
    const success = workflowRunSessionReducer(running, {
      type: 'event',
      generation: 1,
      event: { step: '', status: 'done', data: { runId: 'run', output: { result: 'ok' } } },
    });
    expect(success).toMatchObject({
      status: 'success',
      finalOutput: { result: 'ok' },
      error: null,
    });

    const error = workflowRunSessionReducer(running, {
      type: 'event',
      generation: 1,
      event: { step: '', status: 'error', data: { runId: 'run', nodeId: 'writer', error: 'CODE' } },
    });
    expect(error).toMatchObject({
      status: 'error',
      error: 'CODE',
      failedNodeId: 'writer',
      failedNodeCode: 'CODE',
    });
  });

  it('hydrates persisted node runs defensively', () => {
    const snapshots = workflowRunSnapshotsFromNodeRuns([
      {
        id: 'node-run',
        workflowRunId: 'run',
        nodeId: 'approval',
        nodeType: 'approval',
        status: 'waiting_approval',
        input: '{"title":"Confirm"}',
        output: '[]',
        errorCode: undefined,
        errorMessage: undefined,
        durationMs: 120,
        startedAt: '2026-08-09T08:00:00.000Z',
      },
      {
        id: 'failed-run',
        workflowRunId: 'run',
        nodeId: 'failed',
        nodeType: 'llm',
        status: 'error',
        input: '{bad',
        output: '{"partial":true}',
        errorCode: 'UPSTREAM',
        errorMessage: '',
        startedAt: 'invalid',
      },
    ]);

    expect(snapshots.approval).toMatchObject({
      status: 'running',
      input: { title: 'Confirm' },
      output: undefined,
      durationMs: 120,
      startedAt: Date.parse('2026-08-09T08:00:00.000Z'),
    });
    expect(snapshots.failed).toMatchObject({
      status: 'error',
      input: undefined,
      output: { partial: true },
      error: 'UPSTREAM',
      startedAt: undefined,
    });
  });
});
