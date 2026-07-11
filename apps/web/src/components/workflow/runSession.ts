import type { WorkflowRunEvent, WorkflowRunEventData } from '@/api/workflow';

export type NodeRunStatus = 'idle' | 'running' | 'success' | 'error';

export interface NodeRunSnapshot {
  status: NodeRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface WorkflowRunSession {
  generation: number;
  runId: string | null;
  status: 'idle' | 'running' | 'success' | 'error';
  nodes: Record<string, NodeRunSnapshot>;
  expandedNodeId: string | null;
  finalOutput: Record<string, unknown> | null;
  error: string | null;
}

export type WorkflowRunSessionAction =
  | { type: 'begin'; generation: number }
  | { type: 'event'; generation: number; event: WorkflowRunEvent }
  | { type: 'error'; generation: number; error: string }
  | { type: 'toggleExpanded'; nodeId: string }
  | { type: 'clearExpanded' };

export function createWorkflowRunSession(): WorkflowRunSession {
  return {
    generation: 0,
    runId: null,
    status: 'idle',
    nodes: {},
    expandedNodeId: null,
    finalOutput: null,
    error: null,
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
      };
    case 'toggleExpanded':
      return {
        ...session,
        expandedNodeId: session.expandedNodeId === action.nodeId ? null : action.nodeId,
      };
    case 'clearExpanded':
      return { ...session, expandedNodeId: null };
    case 'error':
      if (action.generation !== session.generation) return session;
      return {
        ...session,
        status: 'error',
        nodes: closeRunningNodes(session.nodes, action.error),
        error: action.error,
      };
    case 'event':
      return applyWorkflowRunEvent(session, action.generation, action.event);
  }
}

function closeRunningNodes(
  nodes: Record<string, NodeRunSnapshot>,
  error: string,
): Record<string, NodeRunSnapshot> {
  const errorCode = error === '运行已取消' ? 'WORKFLOW_CANCELLED' : 'WORKFLOW_RUN_INTERRUPTED';
  return Object.fromEntries(
    Object.entries(nodes).map(([nodeId, snapshot]) => [
      nodeId,
      snapshot.status === 'running' ? { ...snapshot, status: 'error', error: errorCode } : snapshot,
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
      };
    }
    if (event.status === 'error') {
      return {
        ...session,
        runId: nextRunID,
        status: 'error',
        error: event.message || data?.error || '工作流执行失败',
      };
    }
    return session;
  }

  const current = session.nodes[event.step] || { status: 'idle' as const };
  const snapshot = snapshotFromEvent(event.status, data, current);
  return {
    ...session,
    runId: nextRunID,
    status: snapshot.status === 'error' ? 'error' : session.status,
    nodes: { ...session.nodes, [event.step]: snapshot },
    error: snapshot.status === 'error' ? snapshot.error || session.error : session.error,
  };
}

function snapshotFromEvent(
  status: WorkflowRunEvent['status'],
  data: WorkflowRunEventData | undefined,
  current: NodeRunSnapshot,
): NodeRunSnapshot {
  const nextStatus: NodeRunStatus = status === 'done' ? current.status : status;
  return {
    status: nextStatus,
    input: data?.input ?? current.input,
    output: data?.output ?? current.output,
    error: data?.error ?? current.error,
    durationMs: data?.durationMs ?? current.durationMs,
  };
}

function outputFromData(data: WorkflowRunEventData | undefined): Record<string, unknown> | null {
  return data?.output || null;
}
