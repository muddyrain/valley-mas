import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LongScreenshotNotice } from './LongScreenshotControl';

describe('long screenshot interruption notice', () => {
  it('renders the recovery action as an announced status', () => {
    const markup = renderToStaticMarkup(
      createElement(LongScreenshotNotice, {
        notice: '滚动过快，请回到截图中断位置后慢速滚动',
      }),
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('滚动过快，请回到截图中断位置后慢速滚动');
  });
});
