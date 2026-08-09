import { clamp } from './ambient-inputs';

export interface PrecipitationMotionOptions {
  wind: number;
  intensity: number;
  elapsed: number;
  motionScale: number;
}

export interface PrecipitationMotion {
  velocityX: number;
  velocityZ: number;
  fallSpeed: number;
  streakX: number;
  streakY: number;
  streakZ: number;
  streakLength: number;
  gust: number;
  gustVariation: number;
}

export function derivePrecipitationMotion({
  wind: rawWind,
  intensity: rawIntensity,
  elapsed,
  motionScale: rawMotionScale,
}: PrecipitationMotionOptions): PrecipitationMotion {
  const wind = clamp(rawWind);
  const intensity = clamp(rawIntensity);
  const motionScale = clamp(rawMotionScale);
  const gustWave =
    0.5 + (0.5 * (Math.sin(elapsed * 1.9) + Math.sin(elapsed * 0.73 + 1.2) * 0.55)) / 1.55;
  const steadyWind = wind * (0.82 + intensity * 0.18);
  const gustVariation = wind * (0.12 + intensity * 0.2) * gustWave * motionScale;
  const gust = steadyWind + gustVariation;
  const velocityX = -(0.12 + gust * 18);
  const velocityZ = -(0.04 + gust * 0.72);
  const fallSpeed = 11 + intensity * 8;
  const streakLength = 0.5 + intensity * 0.25 + wind * 0.48;
  const speed = Math.hypot(velocityX, fallSpeed, velocityZ);

  return {
    velocityX,
    velocityZ,
    fallSpeed,
    streakX: (velocityX / speed) * streakLength,
    streakY: (-fallSpeed / speed) * streakLength,
    streakZ: (velocityZ / speed) * streakLength,
    streakLength,
    gust,
    gustVariation,
  };
}
