import { clamp } from './ambient-inputs';
import type { WeatherTargets } from './weather';

export type ThunderDistance = 'near' | 'far';

export interface ThunderEvent {
  sequence: number;
  distance: ThunderDistance;
  intensity: number;
  delaySeconds: number;
}

export interface WeatherLifecycleSnapshot {
  stormFront: number;
  stormEnergy: number;
  lightningFlash: number;
}

export interface WeatherLifecycleState extends WeatherLifecycleSnapshot {
  nextThunderSeconds: number;
  thunderSequence: number;
}

export interface WeatherLifecycleStep {
  state: WeatherLifecycleState;
  thunder: ThunderEvent | null;
}

export function createWeatherLifecycleState(): WeatherLifecycleState {
  return {
    stormFront: 0,
    stormEnergy: 0,
    lightningFlash: 0,
    nextThunderSeconds: 2,
    thunderSequence: 0,
  };
}

export function stepWeatherLifecycle(
  current: Readonly<WeatherLifecycleState>,
  weather: Readonly<WeatherTargets>,
  wind: number,
  deltaSeconds: number,
): WeatherLifecycleStep {
  const delta = Math.max(0, deltaSeconds);
  const windStrength = clamp(wind);
  const stormTarget = clamp(((weather.rain - 0.42) / 0.58) * (0.68 + windStrength * 0.32));
  const energyAmount = 1 - Math.exp(-delta * (stormTarget > current.stormEnergy ? 0.72 : 0.42));
  const stormEnergy = clamp(
    current.stormEnergy + (stormTarget - current.stormEnergy) * energyAmount,
  );
  const stormFront =
    stormTarget > 0.08
      ? clamp(
          current.stormFront + delta * (0.075 + windStrength * 0.06) * (0.45 + stormTarget * 0.55),
        )
      : clamp(current.stormFront - delta * (0.055 + (1 - stormEnergy) * 0.035));
  let lightningFlash = Math.max(0, current.lightningFlash - delta * 3.8);
  let nextThunderSeconds = current.nextThunderSeconds;
  let thunderSequence = current.thunderSequence;
  let thunder: ThunderEvent | null = null;

  if (stormEnergy > 0.52 && stormFront > 0.18) {
    nextThunderSeconds -= delta;
    if (nextThunderSeconds <= 0) {
      thunderSequence += 1;
      const distance: ThunderDistance = thunderSequence % 2 === 1 ? 'far' : 'near';
      const intensity = clamp(stormEnergy * (distance === 'near' ? 1 : 0.72), 0.25, 1);
      thunder = {
        sequence: thunderSequence,
        distance,
        intensity,
        delaySeconds:
          distance === 'near' ? 0.16 + (1 - intensity) * 0.12 : 1.05 + (1 - intensity) * 0.7,
      };
      nextThunderSeconds = distance === 'near' ? 4.8 : 6.4;
      lightningFlash = 1;
    }
  } else {
    nextThunderSeconds = Math.min(2, nextThunderSeconds + delta * 0.35);
  }

  return {
    state: {
      stormFront,
      stormEnergy,
      lightningFlash,
      nextThunderSeconds,
      thunderSequence,
    },
    thunder,
  };
}
