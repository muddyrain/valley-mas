import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AIImageStyleProfile } from '@/api/aiImages';
import { AIImageStylePicker } from './AIImageStylePicker';
import { groupAIImageStyleProfiles } from './aiImageStyleProfiles';

const profiles: AIImageStyleProfile[] = [
  {
    id: 'builtin:cinematic',
    name: '电影风景',
    description: '自然景深、环境光与空间层次',
    source: 'builtin',
  },
  {
    id: 'skill:42',
    name: '自定义水彩',
    description: '已安装的水彩视觉技能',
    source: 'skill',
  },
];

describe('AIImageStylePicker', () => {
  it('presents built-in styles and installed skills as one style dimension', () => {
    expect(groupAIImageStyleProfiles(profiles, '')).toEqual({
      builtin: [profiles[0]],
      skill: [profiles[1]],
    });
  });

  it('shows the selected style on the single unified trigger', () => {
    const markup = renderToStaticMarkup(
      <AIImageStylePicker
        profiles={profiles}
        value={profiles[1]}
        onValueChange={() => undefined}
      />,
    );

    expect(markup).toContain('风格：自定义水彩');
    expect(markup).toContain('data-slot="dialog-trigger"');
    expect(markup).not.toContain('视觉风格：自定义水彩');
  });
});
