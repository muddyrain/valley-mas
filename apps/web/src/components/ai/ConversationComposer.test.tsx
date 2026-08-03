import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConversationComposer } from './ConversationComposer';

describe('ConversationComposer', () => {
  it('shows attached files and exposes the file picker', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value="总结文件"
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        placeholder="输入消息"
        files={[{ id: 'file-1', name: 'requirements.pdf', sizeBytes: 1024 }]}
        onFilesSelected={() => undefined}
        onFileRemove={() => undefined}
      />,
    );

    expect(markup).toContain('requirements.pdf');
    expect(markup).toContain('aria-label="附加文件"');
    expect(markup).toContain('image/jpeg,image/png,image/webp');
    expect(markup).toContain('.md,.markdown,.txt,.pdf,.json,.csv');
  });

  it('shows stop for an empty composer while an agent is running', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value=""
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        placeholder="输入消息"
      />,
    );

    expect(markup).toContain('aria-label="停止生成"');
    expect(markup).not.toContain('aria-label="发送消息"');
  });

  it('keeps the send action available when a queued follow-up has content', () => {
    const markup = renderToStaticMarkup(
      <ConversationComposer
        value="继续补充"
        onValueChange={() => undefined}
        onSubmit={() => undefined}
        onStop={() => undefined}
        placeholder="输入消息"
      />,
    );

    expect(markup).toContain('aria-label="发送消息"');
    expect(markup).not.toContain('aria-label="停止生成"');
    expect(markup).not.toContain('textarea disabled=""');
  });
});
