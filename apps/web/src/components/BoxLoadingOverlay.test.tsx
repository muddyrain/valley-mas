import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BoxLoadingOverlay from './BoxLoadingOverlay';

describe('BoxLoadingOverlay', () => {
  it('renders Thinking Orbs without the old backdrop mask', () => {
    const markup = renderToStaticMarkup(
      <BoxLoadingOverlay
        show
        title="正在加载内容"
        hint="请稍候"
        contentClassName="max-w-72 rounded-xl shadow-lg"
      />,
    );

    expect(markup).toContain('data-slot="thinking-orbs"');
    expect(markup).toContain('正在加载内容');
    expect(markup).toContain('max-w-72');
    expect(markup).toContain('rounded-xl');
    expect(markup).toContain('shadow-lg');
    expect(markup).not.toContain('backdrop-blur');
    expect(markup).not.toContain('animate-spin');
  });

  it('renders nothing while hidden', () => {
    expect(renderToStaticMarkup(<BoxLoadingOverlay show={false} />)).toBe('');
  });
});
