import { describe, expect, it } from 'vitest';
import type { AIAppRun } from '@/api/aiWorkbench';
import {
  buildAssistantExecutionSteps,
  formatAssistantExecution,
  hasAssistantExecutionDetails,
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
  it('formats the final execution state with rounded-up seconds', () => {
    expect(formatAssistantExecution(successfulRun)).toBe('执行完成 3s');
    expect(formatAssistantExecution({ ...successfulRun, status: 'cancelled' })).toBe('已停止');
    expect(formatAssistantExecution({ ...successfulRun, status: 'failed' })).toBe('执行失败');
  });

  it('keeps the execution trigger expandable when the generated content is available', () => {
    expect(hasAssistantExecutionDetails(successfulRun, [], [])).toBe(true);
    expect(hasAssistantExecutionDetails({ ...successfulRun, output: '   ' }, [], [])).toBe(false);
  });

  it('uses the agent execution trace instead of duplicating the final reply', () => {
    expect(
      buildAssistantExecutionSteps([
        {
          id: 'trace-1',
          conversationId: 'conversation-1',
          runId: 'run-1',
          toolName: 'image.generate',
          status: 'succeeded',
          durationMs: 2100,
          createdAt: '2026-08-01T00:00:00Z',
        },
      ]),
    ).toEqual([
      {
        id: 'analysis',
        label: '分析请求',
        detail: '确定处理方式与所需能力',
        kind: 'thinking',
      },
      {
        id: 'trace-1',
        label: '使用工具：图片生成',
        detail: '执行完成 · 3s',
        kind: 'tool',
        failed: false,
      },
      {
        id: 'response',
        label: '整理答复',
        detail: '已生成本轮回复',
        kind: 'result',
      },
    ]);
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
