import { clamp } from './ambient-inputs';
import type { ThunderDistance } from './weather-lifecycle';

export interface ThunderCue {
  distance: ThunderDistance;
  intensity: number;
  delaySeconds: number;
}

export interface ThunderProfile {
  delaySeconds: number;
  durationSeconds: number;
  gain: number;
  lowpassHz: number;
}

export function getThunderProfile(cue: Readonly<ThunderCue>): ThunderProfile {
  const intensity = clamp(cue.intensity);
  const near = cue.distance === 'near';
  return {
    delaySeconds: Math.max(0, cue.delaySeconds),
    durationSeconds: near ? 2.8 : 4.8,
    gain: intensity * (near ? 0.82 : 0.38),
    lowpassHz: near ? 920 : 260,
  };
}
