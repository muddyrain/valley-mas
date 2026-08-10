import { clamp } from './ambient-inputs';

export interface RippleWave {
  radius: number;
  amplitude: number;
  velocity: number;
  maxRadius: number;
}

export function createRippleWaves(count: number): RippleWave[] {
  return Array.from({ length: Math.max(0, Math.floor(count)) }, (_, index) => ({
    radius: 0.14 + index * 0.2,
    amplitude: 0,
    velocity: 0.72 + index * 0.08,
    maxRadius: 1.8 + index * 0.4,
  }));
}

export function stepRippleWaves(
  current: readonly Readonly<RippleWave>[],
  sourceStrength: number,
  iceCover: number,
  deltaSeconds: number,
): RippleWave[] {
  const delta = Math.max(0, deltaSeconds);
  const source = clamp(sourceStrength);
  const propagation = 1 - clamp(iceCover) * 0.88;
  return current.map((wave, index) => {
    const velocity = (0.72 + index * 0.08 + source * 0.54) * (0.34 + propagation * 0.66);
    let radius = wave.radius + velocity * delta;
    let amplitude = wave.amplitude * Math.exp(-delta * (0.78 + index * 0.12));
    const injectedAmplitude = source * propagation * Math.max(0.4, 0.88 - index * 0.12);
    amplitude = Math.max(amplitude, injectedAmplitude);
    if (radius >= wave.maxRadius) {
      radius = 0.14 + index * 0.06;
      amplitude = injectedAmplitude;
    }
    return { ...wave, radius, amplitude, velocity };
  });
}
