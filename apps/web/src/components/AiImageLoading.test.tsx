import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AiImageLoading from './AiImageLoading';

describe('AiImageLoading', () => {
  it('delegates the AI image wait state to Thinking Orbs', () => {
    const markup = renderToStaticMarkup(
      <AiImageLoading show title="AI 正在生成图片" hint="完成后自动更新" />,
    );

    expect(markup).toContain('data-slot="thinking-orbs"');
    expect(markup).toContain('AI 正在生成图片');
    expect(markup).toContain('完成后自动更新');
    expect(markup).not.toContain('animate-ping');
  });
});
