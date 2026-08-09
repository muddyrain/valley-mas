import type { QualityProfile } from './quality';

export function getEffectivePixelRatio(
  devicePixelRatio: number,
  profile: Readonly<QualityProfile>,
): number {
  return Math.min(Math.max(1, devicePixelRatio || 1), profile.dprCap);
}

export function shouldResizeRendererForQuality(
  currentPixelRatio: number,
  devicePixelRatio: number,
  profile: Readonly<QualityProfile>,
): boolean {
  return Math.abs(currentPixelRatio - getEffectivePixelRatio(devicePixelRatio, profile)) > 0.001;
}
