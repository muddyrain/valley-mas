import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlogCoverPreview } from './BlogCoverPreview';

describe('BlogCoverPreview', () => {
  it('crossfades a recovered cover and exposes feedback inside the preview', () => {
    const markup = renderToStaticMarkup(
      <BlogCoverPreview
        src="https://example.com/recovered.jpg"
        previousSrc="https://example.com/original.jpg"
        revealCurrent
        showRecoveryNotice
        visibilityLabel="公开"
      />,
    );

    expect(markup).toContain('data-slot="blog-cover-preview"');
    expect(markup).toContain('https://example.com/original.jpg');
    expect(markup).toContain('https://example.com/recovered.jpg');
    expect(markup).toMatch(/data-slot="blog-cover-previous-image"[^>]*opacity-0/);
    expect(markup).toMatch(/data-slot="blog-cover-current-image"[^>]*scale-100 opacity-100/);
    expect(markup).toContain('role="status"');
    expect(markup).toContain('已恢复上次生成的封面');
    expect(markup).toContain('transition-[opacity,transform]');
    expect(markup).not.toContain('transition-all');
  });

  it('keeps the recovery notice hidden during ordinary cover rendering', () => {
    const markup = renderToStaticMarkup(
      <BlogCoverPreview
        src="https://example.com/current.jpg"
        showRecoveryNotice={false}
        visibilityLabel="私密"
      />,
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="status"');
    expect(markup).not.toContain('https://example.com/original.jpg');
    expect(markup).toContain('当前可见范围：私密');
  });
});
