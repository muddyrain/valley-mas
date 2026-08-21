import type { StagePerformanceTier } from './stagePerformance';

const HERO_EXIT_VIEWPORT_FACTOR = 1.15;
const FLUID_IDLE_DURATION_MS = 600;
const CURL_FULL_SPEED = 800;
const CURL_ATTACK_SECONDS = 0.025;
const CURL_RELEASE_SECONDS = 0.175;
const COVER_FULL_SPEED = 30;
const COVER_ATTACK_SECONDS = 0.035;
const COVER_RELEASE_SECONDS = 0.24;
const STICKER_FLOW_MAX_OFFSET = 10;

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const progress = clamp01((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

export function resolveHeroExitProgress(scroll: number, viewportHeight: number) {
  if (viewportHeight <= 0) return 0;
  return clamp01(scroll / (viewportHeight * HERO_EXIT_VIEWPORT_FACTOR));
}

export function resolveHeroSignalOpacity(exitProgress: number) {
  return 1 - smoothstep(0.42, 0.9, exitProgress);
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

export function resolveCoverMotionTarget(velocity: number) {
  return Math.min(1, Math.max(-1, velocity / COVER_FULL_SPEED));
}

export function dampCoverMotion(current: number, target: number, deltaSeconds: number) {
  const duration =
    Math.abs(target) > Math.abs(current) ? COVER_ATTACK_SECONDS : COVER_RELEASE_SECONDS;
  const alpha = 1 - Math.exp(-Math.max(0, deltaSeconds) / duration);
  return current + (target - current) * alpha;
}

export function resolveAnimatedStickerCount(tier: StagePerformanceTier) {
  if (tier === 'full') return 6;
  if (tier === 'balanced') return 3;
  return 0;
}

interface StickerFlowRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface StickerFlowInput {
  active: boolean;
  pointerX: number;
  pointerY: number;
  rect: StickerFlowRect;
  viewportHeight: number;
  viewportWidth: number;
}

export interface StickerFlowResponse {
  intensity: number;
  offsetX: number;
  offsetY: number;
}

export function resolveStickerFlow({
  active,
  pointerX,
  pointerY,
  rect,
  viewportHeight,
  viewportWidth,
}: StickerFlowInput): StickerFlowResponse {
  if (!active || viewportHeight <= 0 || viewportWidth <= 0) {
    return { intensity: 0, offsetX: 0, offsetY: 0 };
  }

  const pointerPixelX = pointerX * viewportWidth;
  const pointerPixelY = pointerY * viewportHeight;
  const deltaX = rect.left + rect.width / 2 - pointerPixelX;
  const deltaY = rect.top + rect.height / 2 - pointerPixelY;
  const distance = Math.hypot(deltaX, deltaY);
  const reach = Math.min(260, Math.max(150, Math.min(viewportWidth, viewportHeight) * 0.25));
  const intensity = clamp01(1 - distance / reach);
  if (distance === 0 || intensity === 0) return { intensity, offsetX: 0, offsetY: 0 };

  return {
    intensity,
    offsetX: (deltaX / distance) * intensity * STICKER_FLOW_MAX_OFFSET,
    offsetY: (deltaY / distance) * intensity * STICKER_FLOW_MAX_OFFSET,
  };
}
