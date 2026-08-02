import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ConversationAttachmentCard, formatAttachmentSize } from './ConversationAttachmentCard';

describe('ConversationAttachmentCard', () => {
  it('shows a consistent uploading state', () => {
    const markup = renderToStaticMarkup(
      <ConversationAttachmentCard
        name="状态.md"
        mimeType="text/markdown"
        sizeBytes={5300}
        status="uploading"
      />,
    );
    expect(markup).toContain('状态.md');
    expect(markup).toContain('上传中');
  });

  it('formats file sizes for the secondary line', () => {
    expect(formatAttachmentSize(5300)).toBe('5.2 KB');
  });
});
