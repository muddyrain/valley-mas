import type { RequirementAnalysis } from './schemas';

export function isRequirementAnalysis(data: unknown): data is RequirementAnalysis {
  if (typeof data !== 'object' || data === null) return false;

  const obj = data as Record<string, unknown>;

  return (
    typeof obj.summary === 'string' &&
    Array.isArray(obj.modules) &&
    Array.isArray(obj.risks) &&
    Array.isArray(obj.questions)
  );
}
