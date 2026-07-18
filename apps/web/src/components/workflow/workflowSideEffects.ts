const sideEffectLabels = {
  none: null,
  read: '只读',
  write: '写入',
  model_and_storage: 'AI + 存储',
} as const;

export function getWorkflowSideEffectLabel(sideEffect?: string | null): string | null {
  if (!sideEffect) return null;
  return sideEffectLabels[sideEffect as keyof typeof sideEffectLabels] || null;
}
