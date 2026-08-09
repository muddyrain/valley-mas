import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { AIAppRun } from '@/api/aiWorkbench';
import AIAppConversationPage, {
  AIKnowledgeFallbackNotice,
  formatRunFailure,
  isRetryableTaskFailureCode,
} from './index';

describe('AIAppConversationPage', () => {
  it('renders an accessible loading shell without shifting the workspace layout', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/workbench/apps/app-1/conversations/conversation-1']}>
        <Routes>
          <Route
            path="/workbench/apps/:appId/conversations/:conversationId"
            element={<AIAppConversationPage />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('加载智能体会话');
    expect(html).toContain('lg:grid-cols-[17rem_minmax(0,1fr)]');
  });

  it('explains catalog embedding failures instead of showing a generic RAG error', () => {
    expect(formatRunFailure({ errorCode: 'RAG_EMBEDDING_MODEL_UNAVAILABLE' } as AIAppRun)).toBe(
      '没有可用的知识库向量模型，请联系管理员',
    );
    expect(formatRunFailure({ errorCode: 'RAG_EMBEDDING_FAILED' } as AIAppRun)).toBe(
      '知识库向量服务调用失败，请稍后重试',
    );
    expect(formatRunFailure({ errorCode: 'RAG_EMBEDDING_REINDEX_REQUIRED' } as AIAppRun)).toBe(
      '知识库向量已升级，请先重新索引文档',
    );
  });

  it('shows a non-blocking knowledge fallback after the model still answers', () => {
    const html = renderToStaticMarkup(
      <AIKnowledgeFallbackNotice
        run={
          {
            status: 'succeeded',
            knowledgeStatus: 'degraded',
            knowledgeErrorCode: 'RAG_EMBEDDING_FAILED',
          } as AIAppRun
        }
      />,
    );

    expect(html).toContain('已跳过知识库');
    expect(html).toContain('本次回复未使用私有资料');
    expect(html).not.toContain('暂时未完成');
  });

  it('keeps transient historical failures retryable', () => {
    expect(isRetryableTaskFailureCode('RAG_QUERY_FAILED')).toBe(true);
    expect(isRetryableTaskFailureCode('RAG_EMBEDDING_FAILED')).toBe(true);
    expect(isRetryableTaskFailureCode('RAG_EMBEDDING_MODEL_UNAVAILABLE')).toBe(false);
  });
});
