import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import YujiContentState from './YujiContentState';

describe('YujiContentState', () => {
  it('keeps public error copy concise and exposes a retry action', () => {
    const markup = renderToStaticMarkup(
      <YujiContentState message="文章暂时没有抵达。" onRetry={() => undefined} />,
    );

    expect(markup).toContain('文章暂时没有抵达。');
    expect(markup).toContain('重新试试');
    expect(markup).not.toContain('请求失败');
    expect(markup).not.toContain('接口');
  });
});
