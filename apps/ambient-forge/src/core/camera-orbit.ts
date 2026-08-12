import { clamp } from './ambient-inputs';
import { TOWN_LAYOUT_SCALE } from './town-layout';

export interface CameraOrbitState {
  azimuth: number;
  polar: number;
  distance: number;
}

export interface ChaseCameraPose {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

export const MIN_CAMERA_POLAR = 0.5;
export const MAX_CAMERA_POLAR = 1.48;
export const MIN_CAMERA_DISTANCE = 12;
export const MAX_CAMERA_DISTANCE = 84;

const DEFAULT_TOWN_CAMERA_SCALE = TOWN_LAYOUT_SCALE * 0.9;

export const DEFAULT_CAMERA_ORBIT: Readonly<CameraOrbitState> = Object.freeze({
  azimuth: Math.atan2(34, 40),
  polar: Math.acos(
    (28 * DEFAULT_TOWN_CAMERA_SCALE) /
      Math.hypot(
        34 * DEFAULT_TOWN_CAMERA_SCALE,
        28 * DEFAULT_TOWN_CAMERA_SCALE,
        40 * DEFAULT_TOWN_CAMERA_SCALE,
      ),
  ),
  distance: Math.hypot(
    34 * DEFAULT_TOWN_CAMERA_SCALE,
    28 * DEFAULT_TOWN_CAMERA_SCALE,
    40 * DEFAULT_TOWN_CAMERA_SCALE,
  ),
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

export function stepChaseOrbitAngle(
  current: number,
  target: number,
  deltaSeconds: number,
  response = 11,
): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const ease = 1 - Math.exp(-Math.max(0, deltaSeconds) * Math.max(0, response));
  return current + difference * ease;
}

export function stepAnchoredChasePose(
  current: Readonly<ChaseCameraPose>,
  desired: Readonly<ChaseCameraPose>,
  offsetEase: number,
  anchorTranslation: readonly [number, number, number] = [
    desired.target[0] - current.target[0],
    desired.target[1] - current.target[1],
    desired.target[2] - current.target[2],
  ],
): { position: [number, number, number]; target: [number, number, number] } {
  const ease = clamp(offsetEase, 0, 1);
  const translatedPosition = current.position.map(
    (value, index) => value + anchorTranslation[index],
  ) as [number, number, number];
  const translatedTarget = current.target.map(
    (value, index) => value + anchorTranslation[index],
  ) as [number, number, number];
  return {
    target: translatedTarget.map(
      (value, index) => value + (desired.target[index] - value) * ease,
    ) as [number, number, number],
    position: translatedPosition.map(
      (value, index) => value + (desired.position[index] - value) * ease,
    ) as [number, number, number],
  };
}
