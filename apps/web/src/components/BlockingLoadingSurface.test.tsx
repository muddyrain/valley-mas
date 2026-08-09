import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BlockingLoadingSurface from './BlockingLoadingSurface';

describe('BlockingLoadingSurface', () => {
  it('makes background controls inert while exposing one clear loading status', () => {
    const markup = renderToStaticMarkup(
      <BlockingLoadingSurface show title="正在生成封面" hint="完成后自动更新预览">
        <button type="button">选择图片</button>
      </BlockingLoadingSurface>,
    );

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('inert=""');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('pointer-events-auto');
    expect(markup).toContain('cursor-wait');
    expect(markup).toContain('正在生成封面');
    expect(markup).toContain('完成后自动更新预览');
    expect(markup).not.toContain('transition-all');
  });

  it('leaves its content interactive and hides the loading status when idle', () => {
    const markup = renderToStaticMarkup(
      <BlockingLoadingSurface show={false} title="正在生成封面">
        <button type="button">选择图片</button>
      </BlockingLoadingSurface>,
    );

    expect(markup).not.toContain('aria-busy="true"');
    expect(markup).not.toContain('inert=""');
    expect(markup).not.toContain('role="status"');
    expect(markup).toContain('选择图片');
  });
});
