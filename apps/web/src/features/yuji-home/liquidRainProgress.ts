export type LiquidRainScene = 'arrival' | 'refraction' | 'portal';

export interface LiquidRainFrame {
  atmosphere: number;
  imageVisibility: number;
  progress: number;
  scene: LiquidRainScene;
  taglineOpacity: number;
  refraction: number;
  portraitFrost: number;
  transitionBridge: number;
  portalProgress: number;
  paperReveal: number;
}

interface PointerRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothRange(start: number, end: number, value: number) {
  const normalized = clamp01((value - start) / (end - start));
  return normalized * normalized * (3 - 2 * normalized);
}

export function getLiquidRainFrame(rawProgress: number): LiquidRainFrame {
  const progress = clamp01(rawProgress);

  return {
    atmosphere: smoothRange(0.08, 0.2, progress) * (1 - smoothRange(0.4, 0.52, progress)),
    imageVisibility: 0.2 + smoothRange(0.08, 0.68, progress) * 0.7,
    progress,
    scene: progress < 0.34 ? 'arrival' : progress < 0.8 ? 'refraction' : 'portal',
    taglineOpacity: 1 - smoothRange(0.14, 0.44, progress),
    refraction: smoothRange(0.1, 0.6, progress),
    portraitFrost: smoothRange(0.42, 0.5, progress) * (1 - smoothRange(0.64, 0.72, progress)),
    transitionBridge: smoothRange(0.68, 0.74, progress) * (1 - smoothRange(0.8, 0.88, progress)),
    portalProgress: smoothRange(0.8, 0.94, progress),
    paperReveal: smoothRange(0.86, 1, progress),
  };
}

export function normalizeLiquidRainPointer(clientX: number, clientY: number, rect: PointerRect) {
  const x = clamp01((clientX - rect.left) / Math.max(1, rect.width));
  const y = 1 - clamp01((clientY - rect.top) / Math.max(1, rect.height));
  return { x, y };
}
