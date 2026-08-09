export const imageGenerationInputOrder = [
  'recipeId',
  'modelId',
  'subjectContext',
  'prompt',
  'variationMode',
  'aspectRatio',
  'quality',
  'referenceImage',
] as const;

const imageGenerationEnumLabels: Record<string, Record<string, string>> = {
  recipeId: {
    free: '通用图片',
    cover: '文章封面',
  },
  variationMode: {
    precise: '精确遵循',
    balanced: '均衡变化',
    exploratory: '大胆探索',
  },
};

export function getImageGenerationEnumLabel(field: string, value: string): string {
  return imageGenerationEnumLabels[field]?.[value] || value;
}
