import type { WorkflowNodeRun, WorkflowRunEvent, WorkflowRunEventData } from '@/api/workflow';

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped' | 'cancelled';

export interface NodeRunIterationSnapshot {
  status: NodeRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
  durationMs?: number;
  startedAt?: number;
  loopIteration?: number;
  loopDepth?: number;
}

export interface NodeRunSnapshot extends NodeRunIterationSnapshot {
  /** Per-round snapshots are retained for loop-body nodes during one run. */
  iterations?: Record<number, NodeRunIterationSnapshot>;
}

export interface WorkflowRunSession {
  generation: number;
  runId: string | null;
  status: 'idle' | 'running' | 'waiting_approval' | 'success' | 'error' | 'cancelled';
  nodes: Record<string, NodeRunSnapshot>;
  finalOutput: Record<string, unknown> | null;
  error: string | null;
  failedNodeId: string | null;
  failedNodeCode: string | null;
}

export type WorkflowRunSessionAction =
  | { type: 'begin'; generation: number; nodes?: Record<string, NodeRunSnapshot> }
  | { type: 'graphChanged' }
  | { type: 'cancelled'; generation: number }
  | { type: 'event'; generation: number; event: WorkflowRunEvent }
  | {
      type: 'error';
      generation: number;
      error: string;
      failedNodeId?: string;
      failedNodeCode?: string;
    };

export function createWorkflowRunSession(): WorkflowRunSession {
  return {
    generation: 0,
    runId: null,
    status: 'idle',
    nodes: {},
    finalOutput: null,
    error: null,
    failedNodeId: null,
    failedNodeCode: null,
  };
}

export function workflowRunSessionReducer(
  session: WorkflowRunSession,
  action: WorkflowRunSessionAction,
): WorkflowRunSession {
  switch (action.type) {
    case 'begin':
      return {
        ...createWorkflowRunSession(),
        generation: action.generation,
        status: 'running',
        nodes: action.nodes || {},
      };
    case 'graphChanged':
      return {
        ...createWorkflowRunSession(),
        generation: session.generation + 1,
      };
    case 'error':
      if (action.generation !== session.generation) return session;
      return {
        ...session,
        status: 'error',
        nodes: closeRunningNodes(
          session.nodes,
          action.error,
          action.failedNodeId,
          action.failedNodeCode,
        ),
        error: action.error,
        failedNodeId: action.failedNodeId || session.failedNodeId,
        failedNodeCode: action.failedNodeCode || session.failedNodeCode,
      };
    case 'cancelled':
      if (action.generation !== session.generation) return session;
      return {
        ...session,
        status: 'cancelled',
        nodes: closeRunningNodes(
          session.nodes,
          '运行已取消',
          undefined,
          'WORKFLOW_CANCELLED',
          'cancelled',
        ),
        error: null,
        failedNodeId: null,
        failedNodeCode: null,
      };
    case 'event':
      return applyWorkflowRunEvent(session, action.generation, action.event);
  }
}

export function workflowRunSnapshotsFromNodeRuns(
  nodeRuns: WorkflowNodeRun[],
): Record<string, NodeRunSnapshot> {
  return Object.fromEntries(
    nodeRuns.map((nodeRun) => [
      nodeRun.nodeId,
      {
        status: nodeRun.status === 'waiting_approval' ? 'running' : nodeRun.status,
        input: parseObject(nodeRun.input),
        output: parseObject(nodeRun.output),
        error: nodeRun.status === 'error' ? nodeRun.errorMessage || nodeRun.errorCode : undefined,
        errorCode: nodeRun.errorCode,
        durationMs: nodeRun.durationMs,
        startedAt: parseStartedAt(nodeRun.startedAt),
      },
    ]),
  );
}

function parseObject(value: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseStartedAt(value: string): number | undefined {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : timestamp;
}

function closeRunningNodes(
  nodes: Record<string, NodeRunSnapshot>,
  error: string,
  failedNodeId?: string,
  failedNodeCode?: string,
  terminalStatus: Extract<NodeRunStatus, 'error' | 'cancelled'> = 'error',
): Record<string, NodeRunSnapshot> {
  const errorCode =
    failedNodeCode || (error === '运行已取消' ? 'WORKFLOW_CANCELLED' : 'WORKFLOW_RUN_INTERRUPTED');
  return Object.fromEntries(
    Object.entries(nodes).map(([nodeId, snapshot]) => [
      nodeId,
      snapshot.status === 'running'
        ? {
            ...snapshot,
            status: terminalStatus,
            error: terminalStatus === 'cancelled' ? undefined : error,
            errorCode: nodeId === failedNodeId ? errorCode : (snapshot.errorCode ?? errorCode),
          }
        : snapshot,
    ]),
  );
}

function applyWorkflowRunEvent(
  session: WorkflowRunSession,
  generation: number,
  event: WorkflowRunEvent,
): WorkflowRunSession {
  if (generation !== session.generation) return session;

  const data = event.data;
  const eventRunID = data?.runId;
  if (session.runId && eventRunID && session.runId !== eventRunID) return session;

  const nextRunID = session.runId || eventRunID || null;
  if (!event.step) {
    if (event.status === 'done') {
      return {
        ...session,
        runId: nextRunID,
        status: 'success',
        finalOutput: outputFromData(data),
        error: null,
        failedNodeId: null,
        failedNodeCode: null,
      };
    }
    if (event.status === 'error') {
      const nextError = event.message || data?.error || '工作流执行失败';
      return {
        ...session,
        runId: nextRunID,
        status: 'error',
        error: nextError,
        failedNodeId: data?.nodeId || session.failedNodeId,
        failedNodeCode: data?.error || session.failedNodeCode,
      };
    }
    if (event.status === 'cancelled') {
      return {
        ...session,
        runId: nextRunID,
        status: 'cancelled',
        nodes: closeRunningNodes(
          session.nodes,
          '运行已取消',
          data?.nodeId,
          data?.error,
          'cancelled',
        ),
        error: null,
        failedNodeId: null,
        failedNodeCode: null,
      };
    }
    return session;
  }

  const nodeID = workflowRunEventNodeID(event);
  const current: NodeRunSnapshot = session.nodes[nodeID] || { status: 'idle' };
  const snapshot = snapshotWithIteration(
    snapshotFromEvent(event.status, event.message, data, current),
    data,
    current,
  );
  if (event.status === 'waiting_approval') {
    return {
      ...session,
      runId: nextRunID,
      status: 'waiting_approval',
      nodes: { ...session.nodes, [nodeID]: snapshot },
    };
  }
  if (event.status === 'cancelled') {
    return {
      ...session,
      runId: nextRunID,
      status: 'cancelled',
      nodes: {
        ...closeRunningNodes(session.nodes, '运行已取消', nodeID, data?.error, 'cancelled'),
        [nodeID]: snapshot,
      },
      error: null,
      failedNodeId: null,
      failedNodeCode: null,
    };
  }
  const hasSnapshotError = snapshot.error != null;
  if (hasSnapshotError) {
    return {
      ...session,
      runId: nextRunID,
      status: 'error',
      nodes: { ...session.nodes, [nodeID]: snapshot },
      error: snapshot.error || session.error,
      failedNodeId: nodeID,
      failedNodeCode: data?.error || session.failedNodeCode,
    };
  }

  return {
    ...session,
    runId: nextRunID,
    status: hasSnapshotError ? 'error' : session.status,
    nodes: { ...session.nodes, [nodeID]: snapshot },
  };
}

/**
 * Loop body execution events keep the loop as `step` and identify the actual
 * body node separately. The canvas gives that child a deterministic ID using
 * the same parent/body pair, so routing the snapshot through this key lets the
 * child card and its edges render their own runtime state.
 */
export function workflowRunEventNodeID(event: WorkflowRunEvent) {
  const bodyNodeID = event.data?.bodyNodeId;
  return bodyNodeID ? `${event.step}::loop-node::${bodyNodeID}` : event.step;
}

function snapshotFromEvent(
  status: WorkflowRunEvent['status'],
  message: string | undefined,
  data: WorkflowRunEventData | undefined,
  current: NodeRunSnapshot,
): NodeRunSnapshot {
  if (status === 'running') {
    return {
      status,
      input: data?.input ?? current.input,
      loopIteration: data?.loopIteration,
      loopDepth: data?.loopDepth,
      iterations: current.iterations,
      // A resumed node starts a new attempt. Reusing the failed attempt's start
      // time would make the live timer include the time spent waiting to retry.
      startedAt: current.status === 'running' ? current.startedAt : Date.now(),
    };
  }
  const nextStatus: NodeRunStatus =
    status === 'done' ? current.status : status === 'waiting_approval' ? 'running' : status;
  const nextError = status === 'error' ? message || data?.error || current.error : current.error;
  return {
    status: nextStatus,
    input: data?.input ?? current.input,
    output: data?.output ?? current.output,
    error: nextError,
    errorCode: data?.error ?? current.errorCode,
    durationMs: data?.durationMs ?? current.durationMs,
    startedAt: current.startedAt,
    loopIteration: data?.loopIteration ?? current.loopIteration,
    loopDepth: data?.loopDepth ?? current.loopDepth,
    iterations: current.iterations,
  };
}

function snapshotWithIteration(
  snapshot: NodeRunSnapshot,
  data: WorkflowRunEventData | undefined,
  current: NodeRunSnapshot,
): NodeRunSnapshot {
  if (!data?.bodyNodeId || data.loopIteration == null) return snapshot;
  const { iterations: _iterations, ...iterationSnapshot } = snapshot;
  return {
    ...snapshot,
    iterations: {
      ...current.iterations,
      [data.loopIteration]: iterationSnapshot,
    },
  };
}

function outputFromData(data: WorkflowRunEventData | undefined): Record<string, unknown> | null {
  return data?.output || null;
}
