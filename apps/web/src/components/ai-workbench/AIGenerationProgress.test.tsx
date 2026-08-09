import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AIGenerationProgress } from './AIGenerationProgress';

describe('AIGenerationProgress', () => {
  it('uses Thinking Orbs for AI generation instead of decorative skeleton bars', () => {
    const markup = renderToStaticMarkup(
      <AIGenerationProgress title="正在规划" description="正在整理内容" />,
    );

    expect(markup).toContain('data-slot="thinking-orbs"');
    expect(markup).toContain('正在规划');
    expect(markup).toContain('正在整理内容');
    expect(markup).not.toContain('data-slot="skeleton"');
  });
});
