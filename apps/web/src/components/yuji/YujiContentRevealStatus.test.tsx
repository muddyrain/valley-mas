import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import YujiContentRevealStatus from './YujiContentRevealStatus';

describe('YujiContentRevealStatus', () => {
  it('announces loading through a content-shaped surface without developer-facing copy', () => {
    const markup = renderToStaticMarkup(
      <YujiContentRevealStatus label="影像正在显影" className="custom-status" variant="gallery" />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('影像正在显影');
    expect(markup).toContain('custom-status');
    expect(markup).toContain('data-variant="gallery"');
    expect(markup).not.toContain('YUJI / DEVELOPING');
    expect(markup).not.toContain('progressbar');
  });

  it('can expose the loading label when the page needs a visible status', () => {
    const markup = renderToStaticMarkup(
      <YujiContentRevealStatus label="文章正在显影" showLabel variant="article" />,
    );

    expect(markup).toContain('class="yuji-reveal-label"');
    expect(markup).toContain('文章正在显影');
    expect(markup).not.toContain('class="sr-only"');
  });

  it('uses an article-shaped editorial skeleton for writing indexes', () => {
    const markup = renderToStaticMarkup(
      <YujiContentRevealStatus label="文章正在显影" variant="writing" />,
    );

    expect(markup).toContain('class="yuji-writing-reveal"');
    expect(markup).toContain('ARTICLE INDEX / LOADING');
    expect(markup.match(/yuji-writing-reveal-card/g)).toHaveLength(4);
    expect(markup).not.toContain('yuji-reveal-shapes');
  });
});
