import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/utils/request', () => ({
  default: requestMocks,
}));

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: {
    getState: () => ({ token: 'workflow-token' }),
  },
}));

import {
  cancelWorkflowRun,
  cancelWorkflowRunNode,
  createAIWorkflowDraft,
  createWorkflow,
  createWorkflowTestCase,
  createWorkflowTrigger,
  decideWorkflowApproval,
  deleteWorkflow,
  deleteWorkflowTestCase,
  deleteWorkflowTrigger,
  explainWorkflowRun,
  getWorkflow,
  getWorkflowPlatform,
  getWorkflowRun,
  getWorkflowWebhookURL,
  listWorkflowApprovals,
  listWorkflowCapabilities,
  listWorkflowRuns,
  listWorkflows,
  listWorkflowTestCases,
  listWorkflowTriggers,
  publishWorkflowVersion,
  restoreWorkflowVersion,
  resumeWorkflowRun,
  retryWorkflowRun,
  rotateWorkflowWebhookSecret,
  runWorkflow,
  runWorkflowTestCase,
  updateWorkflow,
  updateWorkflowTrigger,
} from './workflow';

function streamResponse(chunks: string[], init: ResponseInit = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'text/event-stream');
  return new Response(stream, { ...init, headers });
}

function interruptedStreamResponse(chunk: string, error: Error): Response {
  const encoder = new TextEncoder();
  let delivered = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!delivered) {
        delivered = true;
        controller.enqueue(encoder.encode(chunk));
        return;
      }
      controller.error(error);
    },
  });
  return new Response(stream, {
    headers: { 'content-type': 'text/event-stream' },
  });
}

describe('workflow HTTP contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('maps workflow CRUD, capability, AI, run-history, test, trigger, and approval endpoints', async () => {
    const signal = new AbortController().signal;
    await listWorkflowCapabilities();
    await createAIWorkflowDraft('build it', 'model-1', undefined, signal);
    await explainWorkflowRun('workflow', 'run', 'model-1');
    await createWorkflow({ name: 'Demo' });
    await listWorkflows({ page: 2, pageSize: 10 });
    await getWorkflow('workflow');
    await updateWorkflow('workflow', { name: 'Updated', baseRevision: 2 }, { signal });
    await deleteWorkflow('workflow');
    await cancelWorkflowRun('workflow', 'run');
    await cancelWorkflowRunNode('workflow', 'run', 'node');
    await listWorkflowRuns('workflow', { page: 3 });
    await getWorkflowRun('workflow', 'run');
    await listWorkflowTestCases('workflow');
    await createWorkflowTestCase('workflow', {
      name: 'case',
      versionId: 'version',
      inputs: { topic: 'AI' },
      assertions: [{ field: 'title', operator: 'exists' }],
    });
    await deleteWorkflowTestCase('workflow', 'case');
    await runWorkflowTestCase('workflow', 'case');
    await getWorkflowPlatform('workflow');
    await restoreWorkflowVersion('workflow', 'version');
    await publishWorkflowVersion('workflow');
    await listWorkflowTriggers('workflow');
    await createWorkflowTrigger('workflow', {
      type: 'cron',
      cronExpression: '0 * * * *',
      timezone: 'UTC',
    });
    await updateWorkflowTrigger('workflow', 'trigger', 'disabled');
    await deleteWorkflowTrigger('workflow', 'trigger');
    await rotateWorkflowWebhookSecret('workflow', 'trigger');
    await listWorkflowApprovals('workflow');
    await decideWorkflowApproval('workflow', 'approval', 'approved', 'looks good');

    expect(requestMocks.get.mock.calls).toEqual(
      expect.arrayContaining([
        ['/workflows/capabilities'],
        ['/workflows', { params: { page: 2, pageSize: 10 } }],
        ['/workflows/workflow'],
        ['/workflows/workflow/runs', { params: { page: 3 } }],
        ['/workflows/workflow/runs/run'],
        ['/workflows/workflow/test-cases'],
        ['/workflows/workflow/platform'],
        ['/workflows/workflow/triggers'],
        ['/workflows/workflow/approvals'],
      ]),
    );
    expect(requestMocks.post.mock.calls).toEqual(
      expect.arrayContaining([
        [
          '/workflows/ai-draft',
          { description: 'build it', modelId: 'model-1', current: undefined },
          { signal },
        ],
        ['/workflows/workflow/runs/run/explain', { modelId: 'model-1' }],
        ['/workflows', { name: 'Demo' }],
        ['/workflows/workflow/runs/run/cancel'],
        ['/workflows/workflow/runs/run/nodes/node/cancel'],
        ['/workflows/workflow/test-cases/case/run'],
        ['/workflows/workflow/restore', { versionId: 'version' }],
        ['/workflows/workflow/publish'],
        ['/workflows/workflow/triggers/trigger/rotate-secret'],
        [
          '/workflows/workflow/approvals/approval/decision',
          { decision: 'approved', note: 'looks good' },
        ],
      ]),
    );
    expect(requestMocks.put).toHaveBeenCalledWith(
      '/workflows/workflow',
      { name: 'Updated', baseRevision: 2 },
      { signal },
    );
    expect(requestMocks.patch).toHaveBeenCalledWith('/workflows/workflow/triggers/trigger', {
      status: 'disabled',
    });
    expect(requestMocks.delete.mock.calls).toEqual(
      expect.arrayContaining([
        ['/workflows/workflow'],
        ['/workflows/workflow/test-cases/case'],
        ['/workflows/workflow/triggers/trigger'],
      ]),
    );
  });

  it('builds absolute webhook URLs for relative API bases', () => {
    vi.stubGlobal('window', { location: { origin: 'https://valley.example' } });
    expect(getWorkflowWebhookURL('trigger-1')).toBe(
      'https://valley.example/api/v1/workflow-hooks/trigger-1',
    );
  });
});

describe('workflow SSE runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('submits multipart inputs and files, parses split SSE records, and stops on done', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"step":"start","sequence":1,"status":"run',
          'ning","data":{"runId":"run-1"}}\n',
          'ignored: line\n',
          'data: malformed\n',
          'data: {"step":"workflow","sequence":2,"status":"done"}\n',
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onEvent = vi.fn();
    const onError = vi.fn();
    const file = new File(['# title'], 'post.md', { type: 'text/markdown' });

    await runWorkflow(
      'workflow-1',
      { inputs: { topic: 'AI' }, files: { source: file } },
      { onEvent, onError },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/workflows/workflow-1/run');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer workflow-token', Accept: 'text/event-stream' },
    });
    expect((init.body as FormData).get('inputs')).toBe('{"topic":"AI"}');
    expect((init.body as FormData).get('source')).toBeInstanceOf(File);
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenLastCalledWith(
      expect.objectContaining({ step: 'workflow', status: 'done' }),
    );
    expect(onError).not.toHaveBeenCalled();
  });

  it('resumes a disconnected run after the last sequence and consumes the terminal event', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        streamResponse([
          'data: {"step":"writer","sequence":7,"status":"running","data":{"runId":"run-7"}}\n',
        ]),
      )
      .mockResolvedValueOnce(
        streamResponse(['data: {"step":"workflow","sequence":8,"status":"done"}\n']),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onEvent = vi.fn();
    const onError = vi.fn();

    await runWorkflow('workflow-1', { inputs: {} }, { onEvent, onError });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/workflows/workflow-1/runs/run-7/events');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: {
        Authorization: 'Bearer workflow-token',
        Accept: 'text/event-stream',
        'Last-Event-ID': '7',
      },
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('resumes a run when reading the initial stream throws after the run id was received', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        interruptedStreamResponse(
          'data: {"step":"image","sequence":7,"status":"running","data":{"runId":"run-7"}}\n',
          new TypeError('network error'),
        ),
      )
      .mockResolvedValueOnce(
        streamResponse(['data: {"step":"workflow","sequence":8,"status":"done"}\n']),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onEvent = vi.fn();
    const onError = vi.fn();

    await runWorkflow('workflow-1', { inputs: {} }, { onEvent, onError });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/workflows/workflow-1/runs/run-7/events');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      headers: {
        Authorization: 'Bearer workflow-token',
        Accept: 'text/event-stream',
        'Last-Event-ID': '7',
      },
    });
    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('keeps a received terminal result when the transport errors while closing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        interruptedStreamResponse(
          'data: {"step":"workflow","sequence":8,"status":"done","data":{"runId":"run-8"}}\n',
          new TypeError('network error'),
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onEvent = vi.fn();
    const onError = vi.fn();

    await runWorkflow('workflow-1', { inputs: {} }, { onEvent, onError });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledOnce();
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports JSON, proxy, and non-stream HTTP errors with actionable messages', async () => {
    const onEvent = vi.fn();
    const onError = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: '版本已冲突' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('Error: connect ECONNREFUSED 127.0.0.1', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('gateway returned HTML', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await runWorkflow('workflow', { inputs: {} }, { onEvent, onError });
    await runWorkflow('workflow', { inputs: {} }, { onEvent, onError });
    await runWorkflow('workflow', { inputs: {} }, { onEvent, onError });

    expect(onError.mock.calls).toEqual([
      ['版本已冲突'],
      ['工作流服务未启动或正在重启，请稍后重试。'],
      ['运行服务错误（HTTP 200）：gateway returned HTML'],
    ]);
  });

  it('reports a stream error once and does not add a disconnected-stream error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        streamResponse([
          'data: {"step":"writer","status":"error","message":"模型失败","data":{"runId":"run"}}\n',
        ]),
      );
    vi.stubGlobal('fetch', fetchMock);
    const onError = vi.fn();

    await runWorkflow('workflow', { inputs: {} }, { onEvent: vi.fn(), onError });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith('模型失败');
  });

  it('passes side-effect confirmation headers for retry and resume', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(streamResponse(['data: {"step":"workflow","status":"done"}\n']))
      .mockResolvedValueOnce(streamResponse(['data: {"step":"workflow","status":"done"}\n']));
    vi.stubGlobal('fetch', fetchMock);

    await retryWorkflowRun(
      'workflow',
      'source-run',
      { inputs: { retry: true } },
      { onEvent: vi.fn(), onError: vi.fn() },
      { confirmedSideEffects: true },
    );
    await resumeWorkflowRun(
      'workflow',
      'source-run',
      { onEvent: vi.fn(), onError: vi.fn() },
      { confirmedSideEffects: false },
    );

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/workflows/workflow/runs/source-run/retry');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'X-Workflow-Retry-Confirmed': 'true',
    });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/workflows/workflow/runs/source-run/resume');
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      'X-Workflow-Resume-Confirmed': 'false',
    });
  });

  it('maps an aborted transport to the stable cancellation message', async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('transport aborted')));
    const onError = vi.fn();

    await runWorkflow('workflow', { inputs: {} }, { onEvent: vi.fn(), onError }, controller.signal);

    expect(onError).toHaveBeenCalledWith('运行已取消');
  });
});
