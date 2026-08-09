import { describe, expect, it } from 'vitest';
import {
  getImageGenerationEnumLabel,
  imageGenerationInputOrder,
} from './imageGenerationToolPresentation';

describe('image generation tool presentation', () => {
  it('puts the cover purpose and article context before the optional prompt', () => {
    expect(imageGenerationInputOrder).toEqual([
      'recipeId',
      'modelId',
      'subjectContext',
      'prompt',
      'variationMode',
      'aspectRatio',
      'quality',
      'referenceImage',
    ]);
  });

  it('uses product labels for recipes and variation modes', () => {
    expect(getImageGenerationEnumLabel('recipeId', 'cover')).toBe('文章封面');
    expect(getImageGenerationEnumLabel('recipeId', 'free')).toBe('通用图片');
    expect(getImageGenerationEnumLabel('variationMode', 'exploratory')).toBe('大胆探索');
    expect(getImageGenerationEnumLabel('unknown', 'custom')).toBe('custom');
  });
});
