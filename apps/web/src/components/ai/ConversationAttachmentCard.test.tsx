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

  it('renders the measured upload percentage instead of a fixed progress bar', () => {
    const markup = renderToStaticMarkup(
      <ConversationAttachmentCard
        name="report.pdf"
        mimeType="application/pdf"
        sizeBytes={5300}
        status="uploading"
        progress={37}
      />,
    );

    expect(markup).toContain('上传中 37%');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="37"');
    expect(markup).toContain('width:37%');
    expect(markup).not.toContain('w-2/3');
    expect(markup).not.toContain('animate-pulse');
  });

  it('shows server processing after all request bytes have been uploaded', () => {
    const markup = renderToStaticMarkup(
      <ConversationAttachmentCard
        name="notes.md"
        mimeType="text/markdown"
        sizeBytes={5300}
        status="uploading"
        progress={100}
      />,
    );

    expect(markup).toContain('处理中');
    expect(markup).not.toContain('上传中 100%');
  });

  it('formats file sizes for the secondary line', () => {
    expect(formatAttachmentSize(5300)).toBe('5.2 KB');
  });
});
