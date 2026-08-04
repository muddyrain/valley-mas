import type { WorkflowItem } from '@/api/workflow';
import request, { type RequestConfig } from '@/utils/request';

const collaborationRequestConfig: RequestConfig = { suppressErrorToast: true };

export interface WorkflowCollaborationSession {
  id: string;
  scope: 'workflow';
  targetId: string;
  title: string;
  canonical: boolean;
  archivedAt?: string;
  contextResetAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCollaborationMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  kind: 'text' | 'answer' | 'clarify' | 'result' | 'conflicted';
  content: string;
  createdAt: string;
}

export interface WorkflowCollaborationAttachment {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: 'ready';
  createdAt: string;
}

export type WorkflowCollaborationTaskStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'conflicted';

export interface WorkflowCollaborationTask {
  id: string;
  workflowId: string;
  sessionId: string;
  userMessageId: string;
  changeId?: string;
  title: string;
  status: WorkflowCollaborationTaskStatus;
  progress: number;
  statusMessage: string;
  partialOutput?: string;
  queuePosition?: number;
  errorCode?: string;
  baseRevision: number;
  baseHash: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
}

export interface WorkflowCollaborationDiff {
  added?: string[];
  removed?: string[];
  updated?: string[];
  risks?: string[];
}

export interface WorkflowCollaborationChange {
  id: string;
  taskId: string;
  appliedRevision: number;
  revertedRevision?: number;
  appliedHash: string;
  forwardOperations: string;
  diff: string | WorkflowCollaborationDiff;
  conflictPaths?: string;
  status: 'applied' | 'reverted';
  createdAt: string;
  revertedAt?: string;
}

export interface WorkflowCollaborationData {
  enabled: boolean;
  session: WorkflowCollaborationSession;
  messages: WorkflowCollaborationMessage[];
  tasks: WorkflowCollaborationTask[];
  changes: WorkflowCollaborationChange[];
  approvals: unknown[];
  archivedSessions: WorkflowCollaborationSession[];
}

export function parseWorkflowCollaborationDiff(
  value: string | WorkflowCollaborationDiff,
): WorkflowCollaborationDiff {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as WorkflowCollaborationDiff;
  } catch {
    return {};
  }
}

export function getWorkflowCollaboration(workflowId: string): Promise<WorkflowCollaborationData> {
  return request.get(`/workflows/${workflowId}/collaboration`, collaborationRequestConfig);
}

export function createWorkflowCollaborationTask(
  workflowId: string,
  data: {
    message: string;
    modelId?: string;
    attachmentIds?: string[];
    context?: { selectedNodeId?: string; nodeLabels?: Record<string, string> };
  },
): Promise<{
  session: WorkflowCollaborationSession;
  message: WorkflowCollaborationMessage;
  task: WorkflowCollaborationTask;
}> {
  return request.post(
    `/workflows/${workflowId}/collaboration/tasks`,
    data,
    collaborationRequestConfig,
  );
}

export function uploadWorkflowCollaborationAttachment(
  workflowId: string,
  file: File,
): Promise<{ attachment: WorkflowCollaborationAttachment }> {
  const formData = new FormData();
  formData.append('file', file);
  return request.post(`/workflows/${workflowId}/collaboration/attachments`, formData, {
    ...collaborationRequestConfig,
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export function deleteWorkflowCollaborationAttachment(
  workflowId: string,
  attachmentId: string,
): Promise<void> {
  return request.delete(
    `/workflows/${workflowId}/collaboration/attachments/${attachmentId}`,
    collaborationRequestConfig,
  );
}

export function cancelWorkflowCollaborationTask(
  workflowId: string,
  taskId: string,
): Promise<{ task: WorkflowCollaborationTask }> {
  return request.post(
    `/workflows/${workflowId}/collaboration/tasks/${taskId}/cancel`,
    {},
    collaborationRequestConfig,
  );
}

export function resetWorkflowCollaborationContext(
  workflowId: string,
): Promise<{ session: WorkflowCollaborationSession }> {
  return request.post(
    `/workflows/${workflowId}/collaboration/context/reset`,
    {},
    collaborationRequestConfig,
  );
}

export function revertWorkflowCollaborationChange(
  workflowId: string,
  changeId: string,
): Promise<{ workflow: WorkflowItem; graphHash: string; revision: number }> {
  return request.post(
    `/workflows/${workflowId}/collaboration/changes/${changeId}/revert`,
    {},
    collaborationRequestConfig,
  );
}
