import { clamp, type WeatherMode } from './ambient-inputs';

export interface WeatherTargets {
  rain: number;
  snow: number;
  fog: number;
  desaturation: number;
  cloudCover: number;
  wetness: number;
}

export interface SurfaceAccumulation {
  wetness: number;
  snowCover: number;
}

export function createSurfaceAccumulation(): SurfaceAccumulation {
  return { wetness: 0, snowCover: 0 };
}

const approach = (current: number, target: number, rate: number, deltaSeconds: number): number => {
  const amount = 1 - Math.exp(-Math.max(0, rate) * Math.max(0, deltaSeconds));
  return clamp(current + (target - current) * amount);
};

export function stepSurfaceAccumulation(
  current: Readonly<SurfaceAccumulation>,
  weather: Readonly<WeatherTargets>,
  deltaSeconds: number,
): SurfaceAccumulation {
  const raining = weather.rain > 0.01;
  const snowing = weather.snow > 0.01;
  const wetTarget = raining ? Math.max(weather.wetness, weather.rain) : weather.wetness * 0.4;
  const wetRate = raining ? 0.17 + weather.rain * 0.08 : 0.018 + weather.snow * 0.012;
  const meltRate = 0.055 + weather.rain * 0.16 + weather.wetness * 0.04;
  return {
    wetness: approach(current.wetness, wetTarget, wetRate, deltaSeconds),
    snowCover: approach(
      current.snowCover,
      snowing ? weather.snow : 0,
      snowing ? 0.11 + weather.snow * 0.04 : meltRate,
      deltaSeconds,
    ),
  };
}

export function getWeatherTargets(mode: WeatherMode, intensity: number): WeatherTargets {
  const value = clamp(intensity);
  if (mode === 'rain') {
    return {
      rain: value,
      snow: 0,
      fog: value * 0.48,
      desaturation: value * 0.42,
      cloudCover: 0.35 + value * 0.65,
      wetness: value,
    };
  }
  if (mode === 'snow') {
    return {
      rain: 0,
      snow: value,
      fog: value * 0.34,
      desaturation: value * 0.2,
      cloudCover: 0.25 + value * 0.52,
      wetness: value * 0.18,
    };
  }
  if (mode === 'fog') {
    return {
      rain: 0,
      snow: 0,
      fog: 0.2 + value * 0.8,
      desaturation: value * 0.34,
      cloudCover: 0.38 + value * 0.5,
      wetness: value * 0.12,
    };
  }
  return {
    rain: 0,
    snow: 0,
    fog: 0,
    desaturation: 0,
    cloudCover: 0.18 + value * 0.08,
    wetness: 0,
  };
}

export function stepWeatherTransition(
  current: WeatherTargets,
  target: WeatherTargets,
  deltaSeconds: number,
  durationSeconds = 1.1,
): WeatherTargets {
  const amount = 1 - Math.exp((-Math.max(0, deltaSeconds) * 3) / Math.max(0.05, durationSeconds));
  return {
    rain: current.rain + (target.rain - current.rain) * amount,
    snow: current.snow + (target.snow - current.snow) * amount,
    fog: current.fog + (target.fog - current.fog) * amount,
    desaturation: current.desaturation + (target.desaturation - current.desaturation) * amount,
    cloudCover: current.cloudCover + (target.cloudCover - current.cloudCover) * amount,
    wetness: current.wetness + (target.wetness - current.wetness) * amount,
  };
}
