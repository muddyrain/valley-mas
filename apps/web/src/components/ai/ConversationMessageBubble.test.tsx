import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConversationMessageBubble } from './ConversationMessageBubble';

describe('ConversationMessageBubble', () => {
  it('turns known source markers into accessible inline citations', () => {
    const markup = renderToStaticMarkup(
      // biome-ignore lint/a11y/useValidAriaRole: role is the conversation component's domain prop.
      <ConversationMessageBubble
        role="assistant"
        content="结论来自资料 [1]，未知标记保留 [9]。"
        citations={[
          {
            index: 1,
            documentName: '产品手册.pdf',
            pageNumber: 3,
            excerpt: '支持后台任务',
          },
        ]}
      />,
    );

    expect(markup).toContain('aria-label="查看引用 1：产品手册.pdf，第 3 页"');
    expect(markup).toContain('title="产品手册.pdf，第 3 页：支持后台任务"');
    expect(markup).toContain('[9]');
  });

  it('does not render an empty user text bubble for attachment-only turns', () => {
    const markup = renderToStaticMarkup(
      // biome-ignore lint/a11y/useValidAriaRole: role is the conversation component's domain prop.
      <ConversationMessageBubble
        role="user"
        content=""
        header={<span>状态.md</span>}
        createdAt="2026-08-02T16:32:00+08:00"
      />,
    );
    expect(markup).toContain('状态.md');
    expect(markup).toContain('hidden');
  });

  it('keeps an attachment-only user bubble visible while its message is queued', () => {
    const markup = renderToStaticMarkup(
      // biome-ignore lint/a11y/useValidAriaRole: role is the conversation component's domain prop.
      <ConversationMessageBubble role="user" content="" header={<span>状态.md</span>}>
        <span>等待智能体</span>
      </ConversationMessageBubble>,
    );

    expect(markup).toContain('等待智能体');
    expect(markup).not.toContain(' hidden');
  });

  it('renders queue state as message metadata instead of changing the bubble content', () => {
    const markup = renderToStaticMarkup(
      // biome-ignore lint/a11y/useValidAriaRole: role is the conversation component's domain prop.
      <ConversationMessageBubble
        role="user"
        content="继续补充"
        status={<span>排队中 · 前面还有 2 条</span>}
      />,
    );

    expect(markup).toContain('data-slot="conversation-message-status"');
    expect(markup).toContain('排队中 · 前面还有 2 条');
  });
});
