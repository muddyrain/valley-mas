import { clamp } from './ambient-inputs';

export interface CameraOrbitState {
  azimuth: number;
  polar: number;
  distance: number;
}

export const MIN_CAMERA_POLAR = 0.5;
export const MAX_CAMERA_POLAR = 1.48;
export const MIN_CAMERA_DISTANCE = 12;
export const MAX_CAMERA_DISTANCE = 40;

export const DEFAULT_CAMERA_ORBIT: Readonly<CameraOrbitState> = Object.freeze({
  azimuth: Math.atan2(12.4, 21),
  polar: Math.acos(8.1 / Math.hypot(12.4, 8.1, 21)),
  distance: Math.hypot(12.4, 8.1, 21),
});

const normalizeAzimuth = (value: number): number =>
  ((((value + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;

export function rotateCameraOrbit(
  state: Readonly<CameraOrbitState>,
  deltaX: number,
  deltaY: number,
): CameraOrbitState {
  return {
    azimuth: normalizeAzimuth(state.azimuth - deltaX * 0.005),
    polar: clamp(state.polar - deltaY * 0.0045, MIN_CAMERA_POLAR, MAX_CAMERA_POLAR),
    distance: state.distance,
  };
}

export function zoomCameraOrbit(
  state: Readonly<CameraOrbitState>,
  deltaY: number,
): CameraOrbitState {
  return {
    ...state,
    distance: clamp(
      state.distance * Math.exp(deltaY * 0.0013),
      MIN_CAMERA_DISTANCE,
      MAX_CAMERA_DISTANCE,
    ),
  };
}

export function orbitCameraPosition(
  state: Readonly<CameraOrbitState>,
  target: readonly [number, number, number],
): [number, number, number] {
  const horizontal = Math.sin(state.polar) * state.distance;
  return [
    target[0] + Math.sin(state.azimuth) * horizontal,
    target[1] + Math.cos(state.polar) * state.distance,
    target[2] + Math.cos(state.azimuth) * horizontal,
  ];
}
