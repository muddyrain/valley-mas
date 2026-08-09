import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ThinkingOrbs from './ThinkingOrbs';

describe('ThinkingOrbs', () => {
  it('renders an accessible three-orb AI waiting state', () => {
    const markup = renderToStaticMarkup(
      <ThinkingOrbs title="正在生成" description="完成后会自动更新" />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('正在生成');
    expect(markup).toContain('完成后会自动更新');
    expect(markup.match(/data-slot="thinking-orb"/g)).toHaveLength(3);
    expect(markup).toContain('motion-reduce:animate-none');
  });

  it('supports a text-free compact media state without adding a mask', () => {
    const markup = renderToStaticMarkup(
      <ThinkingOrbs title="图片加载中" compact hideText className="media-state" />,
    );

    expect(markup).toContain('aria-label="图片加载中"');
    expect(markup).toContain('media-state');
    expect(markup).not.toContain('backdrop-blur');
    expect(markup).not.toContain('animate-spin');
  });
});
