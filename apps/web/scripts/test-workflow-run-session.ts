import assert from 'node:assert/strict';
import {
  createWorkflowRunSession,
  workflowRunSessionReducer,
} from '../src/components/workflow/runSession.ts';

let session = createWorkflowRunSession();
session = workflowRunSessionReducer(session, { type: 'begin', generation: 1 });

session = workflowRunSessionReducer(session, {
  type: 'event',
  generation: 1,
  event: {
    step: 'start',
    status: 'running',
    data: { runId: 'run-1', nodeId: 'start', status: 'running', input: { filename: 'post.md' } },
  },
});
assert.equal(session.runId, 'run-1');
assert.equal(session.nodes.start.status, 'running');

session = workflowRunSessionReducer(session, {
  type: 'event',
  generation: 1,
  event: {
    step: 'loop',
    status: 'running',
    data: {
      runId: 'run-1',
      nodeId: 'loop',
      bodyNodeId: 'writer',
      loopIteration: 1,
      status: 'running',
      input: { prompt: 'draft' },
    },
  },
});
assert.equal(session.nodes['loop::loop-node::writer'].status, 'running');
assert.equal(session.nodes['loop::loop-node::writer'].loopIteration, 1);

session = workflowRunSessionReducer(session, {
  type: 'event',
  generation: 1,
  event: {
    step: 'loop',
    status: 'error',
    message: '大模型响应超时，请稍后重试',
    data: {
      runId: 'run-1',
      nodeId: 'loop',
      bodyNodeId: 'writer',
      status: 'error',
      error: 'AI_UPSTREAM_TIMEOUT',
    },
  },
});
assert.equal(session.failedNodeId, 'loop::loop-node::writer');
assert.equal(session.nodes['loop::loop-node::writer'].errorCode, 'AI_UPSTREAM_TIMEOUT');

session = workflowRunSessionReducer(session, {
  type: 'event',
  generation: 1,
  event: {
    step: 'start',
    status: 'success',
    data: {
      runId: 'run-1',
      nodeId: 'start',
      status: 'success',
      output: { markdownFile: { filename: 'post.md' } },
      durationMs: 3,
    },
  },
});
assert.equal(session.nodes.start.status, 'success');
assert.deepEqual(session.nodes.start.output, { markdownFile: { filename: 'post.md' } });
assert.equal(session.nodes.start.durationMs, 3);

const afterStaleEvent = workflowRunSessionReducer(session, {
  type: 'event',
  generation: 0,
  event: {
    step: 'llm-summary',
    status: 'success',
    data: { runId: 'run-0', nodeId: 'llm-summary', status: 'success', output: { text: 'stale' } },
  },
});
assert.equal(afterStaleEvent, session);

session = workflowRunSessionReducer(session, { type: 'begin', generation: 2 });
assert.equal(session.runId, null);
assert.deepEqual(session.nodes, {});

session = workflowRunSessionReducer(session, {
  type: 'event',
  generation: 2,
  event: {
    step: 'parse-markdown',
    status: 'running',
    data: { runId: 'run-2', nodeId: 'parse-markdown', status: 'running' },
  },
});
session = workflowRunSessionReducer(session, {
  type: 'error',
  generation: 2,
  error: '运行已取消',
});
assert.equal(session.status, 'error');
assert.equal(session.nodes['parse-markdown'].status, 'error');
assert.equal(session.nodes['parse-markdown'].error, '运行已取消');
assert.equal(session.nodes['parse-markdown'].errorCode, 'WORKFLOW_CANCELLED');

console.log('workflow run session tests passed');
