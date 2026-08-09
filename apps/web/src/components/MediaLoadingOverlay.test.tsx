import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MediaLoadingOverlay from './MediaLoadingOverlay';

describe('MediaLoadingOverlay', () => {
  it('uses compact Thinking Orbs without obscuring the media surface', () => {
    const markup = renderToStaticMarkup(<MediaLoadingOverlay show />);

    expect(markup).toContain('data-slot="thinking-orbs"');
    expect(markup).toContain('aria-label="图片加载中"');
    expect(markup).not.toContain('backdrop-blur');
    expect(markup).not.toContain('animate-spin');
  });
});
