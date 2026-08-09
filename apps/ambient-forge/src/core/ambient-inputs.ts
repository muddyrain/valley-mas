export type WeatherMode = 'clear' | 'rain' | 'snow' | 'fog';

export interface AmbientInputs {
  timeOfDay: number;
  weather: WeatherMode;
  weatherIntensity: number;
  wind: number;
  audioLow: number;
  audioMid: number;
  audioHigh: number;
  pointerX: number;
  pointerY: number;
  reducedMotion: boolean;
}

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function createDefaultAmbientInputs(): AmbientInputs {
  return {
    timeOfDay: 12,
    weather: 'clear',
    weatherIntensity: 0.55,
    wind: 0.32,
    audioLow: 0,
    audioMid: 0,
    audioHigh: 0,
    pointerX: 0,
    pointerY: 0,
    reducedMotion: false,
  };
}

export function clampAmbientInputs(inputs: AmbientInputs): AmbientInputs {
  return {
    ...inputs,
    timeOfDay: clamp(inputs.timeOfDay, 0, 24),
    weatherIntensity: clamp(inputs.weatherIntensity),
    wind: clamp(inputs.wind),
    audioLow: clamp(inputs.audioLow),
    audioMid: clamp(inputs.audioMid),
    audioHigh: clamp(inputs.audioHigh),
    pointerX: clamp(inputs.pointerX, -1, 1),
    pointerY: clamp(inputs.pointerY, -1, 1),
  };
}

export function getLocalTimeOfDay(date = new Date()): number {
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}
