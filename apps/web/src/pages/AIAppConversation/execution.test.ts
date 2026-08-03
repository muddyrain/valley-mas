import { describe, expect, it } from 'vitest';
import type { AIAppRun } from '@/api/aiWorkbench';
import {
  formatAssistantExecution,
  formatAssistantToolAction,
  formatAssistantToolSummary,
  hasAssistantExecutionDetails,
  isAssistantRunFailure,
  shouldNotifyTaskQueued,
  shouldShowAssistantExecutionReferences,
} from './execution';

const successfulRun: AIAppRun = {
  id: 'run-1',
  versionId: 'version-1',
  status: 'succeeded',
  model: 'test-model',
  input: '你好',
  output: '你好，有什么可以帮你的？',
  errorCode: '',
  durationMs: 2600,
  createdAt: '2026-08-01T00:00:00Z',
};

describe('AI app conversation execution details', () => {
  it('formats the Aily-style final execution state', () => {
    expect(formatAssistantExecution(successfulRun)).toBe('执行完成 3 秒');
    expect(formatAssistantExecution({ ...successfulRun, status: 'running' })).toBe('正在执行');
    expect(formatAssistantExecution({ ...successfulRun, status: 'cancelled' })).toBe('已停止');
    expect(formatAssistantExecution({ ...successfulRun, status: 'failed' })).toBe('执行失败');
  });

  it('only exposes execution details backed by tools or knowledge references', () => {
    expect(hasAssistantExecutionDetails([], [])).toBe(false);
    expect(
      hasAssistantExecutionDetails(
        [
          {
            id: 'trace-1',
            conversationId: 'conversation-1',
            runId: 'run-1',
            toolName: 'image.generate',
            status: 'succeeded',
            durationMs: 2100,
            createdAt: '2026-08-01T00:00:00Z',
          },
        ],
        [],
      ),
    ).toBe(true);
    expect(
      hasAssistantExecutionDetails(
        [],
        [{ documentName: '资料.md', chunkId: '1', excerpt: '内容' }],
      ),
    ).toBe(true);
  });

  it('uses action-oriented labels for real tool calls', () => {
    expect(formatAssistantToolSummary(['content.search', 'image.generate'])).toBe(
      '调用 2 次工具 · 内容搜索、图片生成',
    );
    expect(formatAssistantToolSummary(['image.generate', 'image.generate'])).toBe(
      '调用 2 次工具 · 图片生成',
    );
    expect(formatAssistantToolAction('content.search')).toBe('搜索内容');
    expect(formatAssistantToolAction('image.generate')).toBe('生成图片');
    expect(formatAssistantToolAction('custom.tool')).toBe('custom.tool');
  });

  it('does not treat an in-progress run as a failed reply', () => {
    expect(isAssistantRunFailure({ ...successfulRun, status: 'running' })).toBe(false);
    expect(isAssistantRunFailure(successfulRun)).toBe(false);
    expect(isAssistantRunFailure({ ...successfulRun, status: 'failed' })).toBe(true);
    expect(isAssistantRunFailure({ ...successfulRun, status: 'cancelled' })).toBe(true);
  });

  it('only reports queueing when the created task is actually queued', () => {
    const task = {
      id: 'task-1',
      conversationId: 'conversation-1',
      runId: 'run-1',
      userMessageId: 'message-1',
      title: 'test',
      status: 'running' as const,
      progress: 5,
      statusMessage: '正在准备',
      partialOutput: '',
      createdAt: '2026-08-02T00:00:00Z',
      updatedAt: '2026-08-02T00:00:00Z',
    };

    expect(shouldNotifyTaskQueued(task)).toBe(false);
    expect(shouldNotifyTaskQueued({ ...task, status: 'queued' })).toBe(false);
    expect(shouldNotifyTaskQueued({ ...task, status: 'queued', queuePosition: 1 })).toBe(true);
  });

  it('does not render legacy references that were attached to a standalone greeting', () => {
    const references = [{ documentName: '测试.md', chunkId: 'chunk-1', excerpt: '测试内容' }];

    expect(shouldShowAssistantExecutionReferences(successfulRun, references)).toBe(false);
    expect(
      shouldShowAssistantExecutionReferences(
        { ...successfulRun, input: '你好，请根据资料回答' },
        references,
      ),
    ).toBe(true);
  });
});
