export type StagePerformanceTier = 'full' | 'balanced' | 'static';

interface PerformanceSignals {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  reducedMotion: boolean;
  viewportWidth: number;
  webgl: boolean;
}

export function resolveStagePerformanceTier({
  deviceMemory,
  hardwareConcurrency,
  reducedMotion,
  viewportWidth,
  webgl,
}: PerformanceSignals): StagePerformanceTier {
  if (!webgl || reducedMotion) return 'static';
  if (
    viewportWidth < 760 ||
    (deviceMemory !== undefined && deviceMemory <= 4) ||
    (hardwareConcurrency !== undefined && hardwareConcurrency <= 4)
  ) {
    return 'balanced';
  }
  return 'full';
}
