import type { QualityLevel } from './quality';

export type ResidentDetailTier = 'hero' | 'near' | 'mid' | 'far';

export interface ResidentDetailContext {
  controlled: boolean;
  quality: QualityLevel;
}

export interface WorldPopulationBudget {
  activeResidents: number;
  activeVehicles: number;
  virtualResidents: number;
  virtualVehicles: number;
}

export function getResidentDetailTier(
  distance: number,
  context: Readonly<ResidentDetailContext>,
): ResidentDetailTier {
  if (context.controlled) return 'hero';
  const qualityScale = context.quality === 'high' ? 1 : context.quality === 'medium' ? 0.82 : 0.68;
  if (distance <= 24 * qualityScale) return 'near';
  if (distance <= 58 * qualityScale) return 'mid';
  return 'far';
}

export function getResidentCameraOcclusion(
  currentlyOccluded: boolean,
  distance: number,
  controlled: boolean,
  blocksChaseView = false,
): boolean {
  if (controlled) return false;
  if (blocksChaseView) return true;
  return currentlyOccluded ? distance < 1.35 : distance < 0.9;
}

export function isResidentBlockingChaseCamera(
  camera: readonly [number, number],
  target: readonly [number, number],
  resident: readonly [number, number],
  currentlyOccluded: boolean,
): boolean {
  const viewX = target[0] - camera[0];
  const viewZ = target[1] - camera[1];
  const viewLengthSquared = viewX * viewX + viewZ * viewZ;
  if (viewLengthSquared < 0.001) return false;
  const residentX = resident[0] - camera[0];
  const residentZ = resident[1] - camera[1];
  const progress = (residentX * viewX + residentZ * viewZ) / viewLengthSquared;
  if (progress <= 0.04 || progress >= 0.98) return false;
  const projectedX = camera[0] + viewX * progress;
  const projectedZ = camera[1] + viewZ * progress;
  const lateralDistance = Math.hypot(resident[0] - projectedX, resident[1] - projectedZ);
  return lateralDistance < (currentlyOccluded ? 1.05 : 0.72);
}

export const getResidentVisualCadence = (tier: ResidentDetailTier): number => {
  if (tier === 'far') return 4;
  if (tier === 'mid') return 2;
  return 1;
};

export interface ResidentVisualAnimationStep {
  accumulatedDelta: number;
  updateDelta: number;
}

export function stepResidentVisualAnimation(
  accumulatedDelta: number,
  delta: number,
  frame: number,
  cadence: number,
  active: boolean,
): ResidentVisualAnimationStep {
  if (!active) return { accumulatedDelta: 0, updateDelta: 0 };
  const safeCadence = Math.max(1, Math.floor(cadence));
  const nextDelta = Math.min(0.12, Math.max(0, accumulatedDelta) + Math.max(0, delta));
  if (frame % safeCadence !== 0) {
    return { accumulatedDelta: nextDelta, updateDelta: 0 };
  }
  return { accumulatedDelta: 0, updateDelta: nextDelta };
}

export const getWorldPopulationBudget = (quality: QualityLevel): WorldPopulationBudget => ({
  activeResidents: quality === 'high' ? 18 : quality === 'medium' ? 15 : 12,
  activeVehicles: quality === 'high' ? 9 : quality === 'medium' ? 7 : 5,
  virtualResidents: 72,
  virtualVehicles: 26,
});
