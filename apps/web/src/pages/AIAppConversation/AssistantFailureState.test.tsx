import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssistantFailureState } from './AssistantFailureState';

describe('AssistantFailureState', () => {
  it('shows a compact user-facing failure without exposing internal error codes', () => {
    const markup = renderToStaticMarkup(
      <AssistantFailureState
        agentName="测试智能体"
        cancelled={false}
        message="模型服务暂时不可用，请稍后再试"
      />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('暂时未完成');
    expect(markup).toContain('模型服务暂时不可用，请稍后再试');
    expect(markup).not.toContain('AI_AGENT_RUN_FAILED');
  });

  it('uses a stopped state for cancelled runs', () => {
    const markup = renderToStaticMarkup(
      <AssistantFailureState agentName="测试智能体" cancelled message="已停止生成" />,
    );

    expect(markup).toContain('已停止');
  });

  it('can join an existing assistant row without rendering a second avatar', () => {
    const markup = renderToStaticMarkup(
      <AssistantFailureState
        agentName="测试智能体"
        cancelled={false}
        message="执行失败"
        showAvatar={false}
      />,
    );

    expect(markup).toContain('执行失败');
    expect(markup).not.toContain('测试智能体头像');
  });

  it('offers an inline retry for recoverable failures', () => {
    const markup = renderToStaticMarkup(
      <AssistantFailureState
        agentName="测试智能体"
        cancelled={false}
        message="知识库检索服务异常"
        onRetry={() => undefined}
      />,
    );

    expect(markup).toContain('>重试<');
  });
});
