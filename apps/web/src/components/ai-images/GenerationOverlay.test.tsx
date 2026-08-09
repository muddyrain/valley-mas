import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GenerationOverlay, GenerationPreview } from './GenerationOverlay';

describe('GenerationPreview', () => {
  it.each([
    ['preparing', '正在准备创作内容'],
    ['generating', '正在生成画面'],
    ['storing', '正在保存结果'],
  ] as const)('shows the %s stage label', (stage, label) => {
    const markup = renderToStaticMarkup(<GenerationPreview stage={stage} />);

    expect(markup).toContain(label);
    expect(markup).toContain(`aria-label="${label}"`);
    expect(markup).toContain('data-slot="thinking-orbs"');
    expect(markup).not.toContain('data-generation-dot');
  });

  it('uses the same Thinking Orbs wait state in the generation surface', () => {
    const markup = renderToStaticMarkup(
      <GenerationOverlay stage="generating" onPause={() => undefined} />,
    );

    expect(markup).toContain('data-slot="thinking-orbs"');
    expect(markup).toContain('图片生成阶段');
    expect(markup).toContain('暂停生成');
    expect(markup).not.toContain('data-slot="skeleton"');
  });
});
