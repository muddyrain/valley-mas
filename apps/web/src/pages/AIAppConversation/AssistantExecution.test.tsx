import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AIAppRun } from '@/api/aiWorkbench';
import { AssistantActiveExecution, AssistantExecutionHeader } from './AssistantExecution';

const successfulRun: AIAppRun = {
  id: 'run-1',
  versionId: 'version-1',
  status: 'succeeded',
  model: 'test-model',
  input: '生成图片',
  output: '图片已生成',
  errorCode: '',
  durationMs: 2600,
  createdAt: '2026-08-01T00:00:00Z',
};

describe('AssistantExecution', () => {
  it('shows only the agent thinking state before any real tool call', () => {
    const markup = renderToStaticMarkup(
      <AssistantActiveExecution startedAt={Date.now()} reply="" tools={[]} />,
    );

    expect(markup).toContain('正在思考');
    expect(markup).not.toContain('分析请求');
    expect(markup).not.toContain('整理答复');
  });

  it('streams an in-progress direct reply below the thinking status', () => {
    const markup = renderToStaticMarkup(
      <AssistantActiveExecution startedAt={Date.now()} reply="这是正在生成的回答" tools={[]} />,
    );

    expect(markup).toContain('正在思考');
    expect(markup).not.toContain('aria-label="展开执行过程"');
    expect(markup).toContain('这是正在生成的回答');
  });

  it('shows live narration and real tool actions while executing', () => {
    const markup = renderToStaticMarkup(
      <AssistantActiveExecution
        startedAt={Date.now() - 5000}
        reply="第一次失败，我再重试一次。"
        tools={[
          {
            id: 'tool-1',
            toolName: 'image.generate',
            narration: '好的，我开始生成图片。',
            status: 'failed',
            durationMs: 0,
          },
        ]}
      >
        <div>当前执行结果</div>
      </AssistantActiveExecution>,
    );

    expect(markup).toContain('正在执行');
    expect(markup).toContain('aria-label="收起执行过程"');
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).toContain('好的，我开始生成图片。');
    expect(markup).toContain('第一次失败，我再重试一次。');
    expect(markup).toContain('调用 1 次工具 · 图片生成');
    expect(markup).toContain('执行命令 生成图片');
    expect(markup).not.toContain('data-execution-result-separator');
    expect(markup).toContain('当前执行结果');
  });

  it('keeps partial output visible while a completed task is being finalized', () => {
    const markup = renderToStaticMarkup(
      <AssistantActiveExecution
        startedAt={Date.now() - 5000}
        reply="这是已经生成的完整回答"
        tools={[]}
        phase="finalizing"
      />,
    );

    expect(markup).toContain('正在完成');
    expect(markup).toContain('这是已经生成的完整回答');
    expect(markup).not.toContain('正在思考');
  });

  it('renders no completed process header for a direct answer', () => {
    const markup = renderToStaticMarkup(
      <AssistantExecutionHeader
        run={successfulRun}
        traces={[]}
        references={[]}
        onReferenceOpen={() => undefined}
      />,
    );

    expect(markup).toBe('');
  });

  it('keeps the latest real execution expanded with tools and knowledge', () => {
    const markup = renderToStaticMarkup(
      <AssistantExecutionHeader
        run={successfulRun}
        traces={[
          {
            id: 'trace-1',
            conversationId: 'conversation-1',
            runId: 'run-1',
            toolName: 'image.generate',
            narration: '工具超时，我再重试一次。',
            status: 'succeeded',
            durationMs: 2100,
            createdAt: '2026-08-01T00:00:00Z',
          },
        ]}
        references={[{ documentName: '品牌资料.md', chunkId: 'chunk-1', excerpt: '摘要' }]}
        defaultOpen
        onReferenceOpen={() => undefined}
      />,
    );

    expect(markup).toContain('执行完成 3 秒');
    expect(markup).toContain('工具超时，我再重试一次。');
    expect(markup).toContain('执行命令 生成图片');
    expect(markup).toContain('参考 1 个知识片段');
    expect(markup).toContain('品牌资料.md');
  });
});
