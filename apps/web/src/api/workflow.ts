import { useAuthStore } from '@/stores/useAuthStore';
import request, { type RequestConfig } from '@/utils/request';

export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'llm'
  | 'tool'
  | 'condition'
  | 'merge'
  | 'variable'
  | 'subworkflow';

export interface WorkflowRule {
  left: unknown;
  operator: 'equals' | 'notEquals' | 'contains' | 'isEmpty' | 'greaterThan' | 'lessThan';
  right?: unknown;
}

export interface WorkflowGraph {
  schemaVersion: 4;
  nodes: Array<{
    id: string;
    type: WorkflowNodeType;
    label: string;
    position: { x: number; y: number };
    config: Record<string, unknown>;
    when?: WorkflowRule;
  }>;
  edges: Array<{
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
  }>;
}

export interface WorkflowItem {
  id: string;
  userId: string;
  name: string;
  description: string;
  graph: string;
  graphHash?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowListData {
  list: WorkflowItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowRunEvent {
  step: string;
  sequence?: number;
  status: 'running' | 'success' | 'error' | 'skipped' | 'cancelled' | 'done';
  message?: string;
  data?: WorkflowRunEventData;
}

export interface WorkflowRunEventData {
  runId?: string;
  sequence?: number;
  nodeId?: string;
  nodeType?: WorkflowNodeType;
  capabilityId?: string;
  status?: 'running' | 'success' | 'error' | 'skipped' | 'cancelled';
  message?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  durationMs?: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: 'running' | 'cancelling' | 'success' | 'error' | 'cancelled';
  inputs: string;
  graphSnapshot: string;
  sourceRunId?: string;
  result: string;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowNodeRun {
  id: string;
  workflowRunId: string;
  nodeId: string;
  nodeType: string;
  capabilityId?: string;
  status: 'running' | 'success' | 'error' | 'skipped' | 'cancelled';
  input: string;
  output: string;
  errorCode?: string;
  durationMs?: number;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowRunTraceEvent {
  id: string;
  workflowRunId: string;
  sequence: number;
  nodeId?: string;
  nodeType?: string;
  capabilityId?: string;
  status: 'running' | 'success' | 'error' | 'skipped' | 'cancelled';
  message?: string;
  input: string;
  output: string;
  errorCode?: string;
  durationMs?: number;
  occurredAt: string;
}

export interface WorkflowRunListData {
  list: WorkflowRun[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WorkflowRunDetail {
  run: WorkflowRun;
  nodes: WorkflowNodeRun[];
  events?: WorkflowRunTraceEvent[];
  retry?: {
    allowed: boolean;
    requiresConfirmation: boolean;
  };
}

export type WorkflowTestAssertionOperator =
  | 'exists'
  | 'type'
  | 'equals'
  | 'contains'
  | 'range'
  | 'jsonSchema';

export interface WorkflowTestAssertion {
  field: string;
  operator: WorkflowTestAssertionOperator;
  value?: unknown;
}

export interface WorkflowTestResult {
  id: string;
  workflowTestCaseId: string;
  workflowRunId?: string;
  workflowId: string;
  versionId: string;
  status: 'passed' | 'failed' | 'error' | 'rejected';
  output: string;
  assertionResults: string;
  errorCode?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface WorkflowTestCase {
  id: string;
  workflowId: string;
  versionId: string;
  name: string;
  inputs: string;
  assertions: string;
  createdAt: string;
  updatedAt: string;
  latestResult?: WorkflowTestResult;
}

export interface AIWorkflowDraft {
  name: string;
  description: string;
  graph: {
    schemaVersion: 4;
    nodes: Array<{
      id: string;
      type: WorkflowNodeType;
      label: string;
      position: { x: number; y: number };
      config: Record<string, unknown>;
      when?: WorkflowRule;
    }>;
    edges: Array<{
      source: string;
      sourceHandle?: string;
      target: string;
      targetHandle?: string;
    }>;
  };
}

export interface WorkflowNodeDefinition {
  type: WorkflowNodeType;
  label: string;
  description: string;
  category: 'model' | 'flow' | 'tool' | 'subworkflow';
  inputPorts: string[];
  outputPorts: string[];
  whenAllowed: boolean;
  configSchema: Record<string, unknown>;
}

export interface WorkflowToolCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  sideEffect: 'none' | 'read' | 'model_and_storage' | 'write';
  modelCost: number;
  writeCost: number;
  available: boolean;
  inputSchema: {
    type?: string;
    required?: string[];
    properties?: Record<
      string,
      { type?: string; title?: string; description?: string; placeholder?: string }
    >;
  };
  outputSchema: Record<string, string>;
  aiUsage: string;
}

export function listWorkflowCapabilities(): Promise<{
  schemaVersion: 4;
  nodeTypes: WorkflowNodeDefinition[];
  toolCapabilities: WorkflowToolCapability[];
  limits: { maxNodes: number; maxModelCapabilities: number; maxWriteCapabilities: number };
}> {
  return request.get('/workflows/capabilities');
}

export interface WorkflowRunExplanation {
  cause: string;
  suggestions: string[];
  nodeId: string;
}

export function createAIWorkflowDraft(
  description: string,
  current?: AIWorkflowDraft,
  signal?: AbortSignal,
): Promise<{ draft: AIWorkflowDraft }> {
  return request.post('/workflows/ai-draft', { description, current }, { signal });
}

export function explainWorkflowRun(
  id: string,
  runId: string,
): Promise<{ explanation: WorkflowRunExplanation }> {
  return request.post(`/workflows/${id}/runs/${runId}/explain`);
}

export interface WorkflowVersion {
  id: string;
  number: number;
  config: string;
  publishedAt?: string;
  createdAt: string;
}

export interface WorkflowPlatformData {
  app: {
    id: string;
    draftVersionId: string;
    publishedVersionId: string;
    status: 'draft' | 'published';
  };
  versions: WorkflowVersion[];
}

export async function createWorkflow(data: {
  name: string;
  description?: string;
  graph?: string;
  status?: string;
}): Promise<WorkflowItem> {
  return request.post('/workflows', data);
}

export async function listWorkflows(params?: {
  page?: number;
  pageSize?: number;
}): Promise<WorkflowListData> {
  return request.get('/workflows', { params });
}

export async function getWorkflow(id: string): Promise<WorkflowItem> {
  return request.get(`/workflows/${id}`);
}

export async function updateWorkflow(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    graph: string;
    status: string;
    baseHash: string;
    recordHistory: boolean;
  }>,
  config?: RequestConfig,
): Promise<{ graphHash: string }> {
  return request.put(`/workflows/${id}`, data, config);
}

export async function deleteWorkflow(id: string): Promise<void> {
  return request.delete(`/workflows/${id}`);
}

function normalizeWorkflowRunProxyError(message: string): string | null {
  const normalized = message.toLowerCase();
  if (
    normalized.includes('econnrefused') ||
    normalized.includes('socket hang up') ||
    normalized.includes('econnreset') ||
    normalized.includes('econnaborted')
  ) {
    return '工作流服务未启动或正在重启，请稍后重试。';
  }
  return null;
}

async function workflowRunErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.text()).trim();
    if (!body) return fallback;

    let data: { message?: unknown } | null = null;
    try {
      data = JSON.parse(body) as { message?: unknown };
    } catch {
      const proxyError = normalizeWorkflowRunProxyError(body);
      if (proxyError) return proxyError;

      const conciseBody = body.replace(/\s+/g, ' ').slice(0, 240);
      return conciseBody ? `运行服务错误（HTTP ${response.status}）：${conciseBody}` : fallback;
    }

    if (typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Keep the caller's fallback when the response body cannot be read.
  }
  return fallback;
}

async function resumeWorkflowRunEvents(
  base: string,
  token: string | null,
  workflowId: string,
  runId: string,
  after: number,
  handlers: { onEvent: (event: WorkflowRunEvent) => void; onError: (msg: string) => void },
  signal?: AbortSignal,
): Promise<boolean> {
  const response = await fetch(`${base}/workflows/${workflowId}/runs/${runId}/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
      'Last-Event-ID': String(after),
    },
    signal,
  });
  if (!response.ok || !response.body) return false;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let terminal = false;
  const handleLines = (text: string) => {
    const lines = text.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const event: WorkflowRunEvent = JSON.parse(line.slice(6));
        handlers.onEvent(event);
        if (event.status === 'done' || event.status === 'cancelled') terminal = true;
        if (event.status === 'error') {
          terminal = true;
          handlers.onError(event.message || event.data?.error || '工作流执行失败');
        }
      } catch {
        // Ignore malformed event records and continue from the next sequence.
      }
    }
  };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    handleLines(buffer);
  }
  buffer += decoder.decode();
  if (buffer) handleLines(`${buffer}\n`);
  return terminal;
}

async function streamWorkflow(
  id: string,
  path: string,
  body: { inputs: Record<string, unknown>; files?: Record<string, File> },
  handlers: {
    onEvent: (event: WorkflowRunEvent) => void;
    onError: (msg: string) => void;
  },
  signal?: AbortSignal,
  headers?: Record<string, string>,
): Promise<void> {
  const token = useAuthStore.getState().token;
  const base =
    (import.meta as { env: { VITE_API_BASE_URL: string } }).env.VITE_API_BASE_URL || '/api/v1';

  const formData = new FormData();
  formData.set('inputs', JSON.stringify(body.inputs));
  for (const [name, file] of Object.entries(body.files || {})) {
    formData.set(name, file, file.name);
  }

  try {
    const response = await fetch(`${base}/workflows/${id}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
        ...headers,
      },
      body: formData,
      signal,
    });

    if (!response.ok) {
      handlers.onError(await workflowRunErrorMessage(response, `请求失败: ${response.status}`));
      return;
    }

    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      handlers.onError(await workflowRunErrorMessage(response, '运行接口未返回事件流'));
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      handlers.onError('无法读取响应流');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let receivedTerminalEvent = false;
    let runId: string | null = null;
    let lastSequence = 0;

    const handleLines = (text: string) => {
      const lines = text.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event: WorkflowRunEvent = JSON.parse(line.slice(6));
          if (event.data?.runId) runId = event.data.runId;
          lastSequence = Math.max(lastSequence, event.sequence || event.data?.sequence || 0);
          handlers.onEvent(event);
          if (event.status === 'done' || event.status === 'cancelled') {
            receivedTerminalEvent = true;
          }
          if (event.status === 'error') {
            receivedTerminalEvent = true;
            handlers.onError(event.message || event.data?.error || '工作流执行失败');
          }
        } catch {
          // Ignore malformed event records and wait for a valid terminal event.
        }
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      handleLines(buffer);
    }

    buffer += decoder.decode();
    if (buffer) handleLines(`${buffer}\n`);
    if (!receivedTerminalEvent && runId && !signal?.aborted) {
      receivedTerminalEvent = await resumeWorkflowRunEvents(
        base,
        token,
        id,
        runId,
        lastSequence,
        handlers,
        signal,
      );
    }
    if (!receivedTerminalEvent) {
      handlers.onError('运行连接已关闭，未收到最终结果');
    }
  } catch (error) {
    if (signal?.aborted) {
      handlers.onError('运行已取消');
      return;
    }
    handlers.onError(error instanceof Error ? error.message : '运行请求失败');
  }
}

export function runWorkflow(
  id: string,
  body: { inputs: Record<string, unknown>; files?: Record<string, File> },
  handlers: {
    onEvent: (event: WorkflowRunEvent) => void;
    onError: (msg: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  return streamWorkflow(id, '/run', body, handlers, signal);
}

export function retryWorkflowRun(
  workflowId: string,
  sourceRunId: string,
  body: { inputs: Record<string, unknown>; files?: Record<string, File> },
  handlers: {
    onEvent: (event: WorkflowRunEvent) => void;
    onError: (msg: string) => void;
  },
  options: { confirmedSideEffects: boolean; signal?: AbortSignal },
): Promise<void> {
  return streamWorkflow(workflowId, `/runs/${sourceRunId}/retry`, body, handlers, options.signal, {
    'X-Workflow-Retry-Confirmed': String(options.confirmedSideEffects),
  });
}

export function cancelWorkflowRun(
  workflowId: string,
  runId: string,
): Promise<{ status: 'cancelling' }> {
  return request.post(`/workflows/${workflowId}/runs/${runId}/cancel`);
}

export function listWorkflowRuns(
  id: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<WorkflowRunListData> {
  return request.get(`/workflows/${id}/runs`, { params });
}

export function getWorkflowRun(id: string, runId: string): Promise<WorkflowRunDetail> {
  return request.get(`/workflows/${id}/runs/${runId}`);
}

export function listWorkflowTestCases(id: string): Promise<{ list: WorkflowTestCase[] }> {
  return request.get(`/workflows/${id}/test-cases`);
}

export function createWorkflowTestCase(
  id: string,
  data: {
    name: string;
    versionId: string;
    inputs: Record<string, unknown>;
    assertions: WorkflowTestAssertion[];
  },
): Promise<WorkflowTestCase> {
  return request.post(`/workflows/${id}/test-cases`, data);
}

export function deleteWorkflowTestCase(id: string, testCaseId: string): Promise<void> {
  return request.delete(`/workflows/${id}/test-cases/${testCaseId}`);
}

export function runWorkflowTestCase(
  id: string,
  testCaseId: string,
): Promise<{ result: WorkflowTestResult }> {
  return request.post(`/workflows/${id}/test-cases/${testCaseId}/run`);
}

export function getWorkflowPlatform(id: string): Promise<WorkflowPlatformData> {
  return request.get(`/workflows/${id}/platform`);
}

export function restoreWorkflowVersion(
  id: string,
  versionId: string,
): Promise<{ version: WorkflowVersion }> {
  return request.post(`/workflows/${id}/restore`, { versionId });
}

export function publishWorkflowVersion(id: string): Promise<void> {
  return request.post(`/workflows/${id}/publish`);
}
