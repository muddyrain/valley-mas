import type { StagePerformanceTier } from './stagePerformance';

const HERO_EXIT_VIEWPORT_FACTOR = 0.75;
const FLUID_IDLE_DURATION_MS = 600;
const CURL_FULL_SPEED = 800;
const CURL_ATTACK_SECONDS = 0.025;
const CURL_RELEASE_SECONDS = 0.175;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function resolveHeroExitProgress(scroll: number, viewportHeight: number) {
  if (viewportHeight <= 0) return 0;
  return clamp01(scroll / (viewportHeight * HERO_EXIT_VIEWPORT_FACTOR));
}

export function resolveFluidActivity(inside: boolean, lastMoveAt: number, now: number) {
  if (!inside || lastMoveAt <= 0) return 0;
  return clamp01(1 - (now - lastMoveAt) / FLUID_IDLE_DURATION_MS);
}

export function resolveCurlTarget(velocity: number) {
  return clamp01(Math.abs(velocity) / CURL_FULL_SPEED);
}

export function dampCurlActivity(current: number, target: number, deltaSeconds: number) {
  const duration = target > current ? CURL_ATTACK_SECONDS : CURL_RELEASE_SECONDS;
  const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) / duration);
  return current + (target - current) * alpha;
}

export function resolveAnimatedStickerCount(tier: StagePerformanceTier) {
  if (tier === 'full') return 6;
  if (tier === 'balanced') return 3;
  return 0;
}
