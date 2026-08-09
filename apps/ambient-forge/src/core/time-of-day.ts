import { clamp } from './ambient-inputs';

export type Rgb = readonly [number, number, number];

export interface TimeOfDayState {
  sky: Rgb;
  horizon: Rgb;
  fog: Rgb;
  sun: Rgb;
  daylight: number;
  sunElevation: number;
  stars: number;
  cabinLight: number;
}

interface TimeKeyframe extends Omit<TimeOfDayState, 'sunElevation'> {
  hour: number;
}

const KEYFRAMES: readonly TimeKeyframe[] = [
  {
    hour: 0,
    sky: [0.018, 0.045, 0.09],
    horizon: [0.055, 0.09, 0.15],
    fog: [0.055, 0.08, 0.12],
    sun: [0.48, 0.58, 0.78],
    daylight: 0.06,
    stars: 1,
    cabinLight: 1,
  },
  {
    hour: 5,
    sky: [0.035, 0.075, 0.14],
    horizon: [0.18, 0.14, 0.2],
    fog: [0.12, 0.12, 0.16],
    sun: [0.92, 0.53, 0.3],
    daylight: 0.12,
    stars: 0.82,
    cabinLight: 0.92,
  },
  {
    hour: 7,
    sky: [0.38, 0.62, 0.78],
    horizon: [0.86, 0.64, 0.42],
    fog: [0.58, 0.66, 0.69],
    sun: [1, 0.73, 0.4],
    daylight: 0.76,
    stars: 0.08,
    cabinLight: 0.18,
  },
  {
    hour: 12,
    sky: [0.28, 0.58, 0.78],
    horizon: [0.68, 0.79, 0.79],
    fog: [0.62, 0.72, 0.73],
    sun: [1, 0.88, 0.62],
    daylight: 1,
    stars: 0,
    cabinLight: 0.08,
  },
  {
    hour: 17,
    sky: [0.31, 0.5, 0.66],
    horizon: [0.73, 0.63, 0.49],
    fog: [0.53, 0.58, 0.6],
    sun: [1, 0.76, 0.46],
    daylight: 0.83,
    stars: 0.03,
    cabinLight: 0.16,
  },
  {
    hour: 19,
    sky: [0.12, 0.13, 0.25],
    horizon: [0.48, 0.25, 0.25],
    fog: [0.24, 0.2, 0.24],
    sun: [1, 0.48, 0.24],
    daylight: 0.28,
    stars: 0.48,
    cabinLight: 0.82,
  },
  {
    hour: 21,
    sky: [0.025, 0.055, 0.11],
    horizon: [0.07, 0.1, 0.17],
    fog: [0.065, 0.085, 0.12],
    sun: [0.5, 0.6, 0.82],
    daylight: 0.08,
    stars: 0.94,
    cabinLight: 1,
  },
  {
    hour: 24,
    sky: [0.018, 0.045, 0.09],
    horizon: [0.055, 0.09, 0.15],
    fog: [0.055, 0.08, 0.12],
    sun: [0.48, 0.58, 0.78],
    daylight: 0.06,
    stars: 1,
    cabinLight: 1,
  },
];

const smoothstep = (value: number): number => value * value * (3 - 2 * value);
const mix = (from: number, to: number, amount: number): number => from + (to - from) * amount;
const mixRgb = (from: Rgb, to: Rgb, amount: number): Rgb => [
  mix(from[0], to[0], amount),
  mix(from[1], to[1], amount),
  mix(from[2], to[2], amount),
];

export function getTimeOfDayState(timeOfDay: number): TimeOfDayState {
  const hour = clamp(timeOfDay, 0, 24);
  let from = KEYFRAMES[0];
  let to = KEYFRAMES[1];
  for (let index = 1; index < KEYFRAMES.length; index += 1) {
    const candidate = KEYFRAMES[index];
    if (candidate && hour <= candidate.hour) {
      to = candidate;
      from = KEYFRAMES[index - 1] ?? KEYFRAMES[0];
      break;
    }
  }

  const duration = Math.max(0.001, to.hour - from.hour);
  const amount = smoothstep(clamp((hour - from.hour) / duration));
  const sunElevation = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));

  return {
    sky: mixRgb(from.sky, to.sky, amount),
    horizon: mixRgb(from.horizon, to.horizon, amount),
    fog: mixRgb(from.fog, to.fog, amount),
    sun: mixRgb(from.sun, to.sun, amount),
    daylight: mix(from.daylight, to.daylight, amount),
    sunElevation,
    stars: mix(from.stars, to.stars, amount),
    cabinLight: mix(from.cabinLight, to.cabinLight, amount),
  };
}
