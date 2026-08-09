import { type AmbientInputs, clamp, clampAmbientInputs } from './ambient-inputs';
import { getTimeOfDayState, type Rgb } from './time-of-day';
import { getWeatherTargets, type SurfaceAccumulation, type WeatherTargets } from './weather';

export interface SceneSignals {
  skyColor: Rgb;
  horizonColor: Rgb;
  fogColor: Rgb;
  sunColor: Rgb;
  daylight: number;
  sunElevation: number;
  starVisibility: number;
  cabinLight: number;
  ambientLight: number;
  sunLight: number;
  fogDensity: number;
  cloudCover: number;
  cloudSpeed: number;
  windStrength: number;
  rain: number;
  snow: number;
  snowCover: number;
  wetness: number;
  islandBreath: number;
  plantSway: number;
  fireflyActivity: number;
  sparkleBrightness: number;
  pointerX: number;
  pointerY: number;
  motionScale: number;
}

const desaturate = (color: Rgb, amount: number): Rgb => {
  const luminance = color[0] * 0.24 + color[1] * 0.68 + color[2] * 0.08;
  return [
    color[0] + (luminance - color[0]) * amount,
    color[1] + (luminance - color[1]) * amount,
    color[2] + (luminance - color[2]) * amount,
  ];
};

export function deriveSceneSignals(
  rawInputs: AmbientInputs,
  weatherTargets?: WeatherTargets,
  surfaceAccumulation?: SurfaceAccumulation,
): SceneSignals {
  const inputs = clampAmbientInputs(rawInputs);
  const time = getTimeOfDayState(inputs.timeOfDay);
  const weather = weatherTargets ?? getWeatherTargets(inputs.weather, inputs.weatherIntensity);
  const motionScale = inputs.reducedMotion ? 0.24 : 1;
  const particleScale = inputs.reducedMotion ? 0.42 : 1;
  const totalEnergy = clamp((inputs.audioLow + inputs.audioMid + inputs.audioHigh) / 3);

  return {
    skyColor: desaturate(time.sky, weather.desaturation),
    horizonColor: desaturate(time.horizon, weather.desaturation * 0.8),
    fogColor: desaturate(time.fog, weather.desaturation),
    sunColor: time.sun,
    daylight: time.daylight,
    sunElevation: time.sunElevation,
    starVisibility: clamp(time.stars * (1 - weather.cloudCover * 0.65)),
    cabinLight: clamp(time.cabinLight + weather.rain * 0.2),
    ambientLight: clamp(0.18 + time.daylight * 0.82 - weather.desaturation * 0.24),
    sunLight: clamp(0.08 + time.daylight * 1.15 - weather.cloudCover * 0.42, 0, 1.3),
    fogDensity: clamp(0.0025 + weather.fog * 0.025 + weather.rain * 0.008, 0, 0.035),
    cloudCover: weather.cloudCover,
    cloudSpeed: (0.035 + inputs.wind * 0.12 + inputs.audioLow * 0.08) * motionScale,
    windStrength: inputs.wind,
    rain: weather.rain,
    snow: weather.snow,
    snowCover: surfaceAccumulation?.snowCover ?? weather.snow,
    wetness: surfaceAccumulation?.wetness ?? weather.wetness,
    islandBreath: Math.min(0.02, inputs.audioLow * 0.016 * motionScale),
    plantSway: (0.025 + inputs.wind * 0.08 + inputs.audioMid * 0.13) * motionScale,
    fireflyActivity: clamp(
      (0.12 + time.stars * 0.4 + inputs.audioHigh * 0.58) *
        particleScale *
        (1 - weather.rain * 0.82 - weather.snow * 0.38),
    ),
    sparkleBrightness: clamp((0.08 + inputs.audioHigh * 0.72 + totalEnergy * 0.16) * particleScale),
    pointerX: inputs.pointerX * motionScale,
    pointerY: inputs.pointerY * motionScale,
    motionScale,
  };
}
