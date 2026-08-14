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
});
