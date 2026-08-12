import type { CameraOrbitState } from './camera-orbit';
import { scaleTownVec3, TOWN_LAYOUT_SCALE } from './town-layout';

export type CameraViewId =
  | 'overview'
  | 'observatory'
  | 'cavern'
  | 'garden'
  | 'crystal'
  | 'ruins'
  | 'harbor'
  | 'greenhouse'
  | 'eastDistrict'
  | 'southRiverside'
  | 'westCoast';

export interface CameraViewPreset {
  label: string;
  target: readonly [number, number, number];
  orbit: Readonly<CameraOrbitState>;
}

export interface CameraTourState {
  enabled: boolean;
  view: CameraViewId;
  elapsed: number;
}

const orbitFromOffset = (x: number, y: number, z: number): Readonly<CameraOrbitState> => {
  const distance = Math.hypot(x, y, z);
  return Object.freeze({
    azimuth: Math.atan2(x, z),
    polar: Math.acos(y / distance),
    distance,
  });
};

const orbitFromTownOffset = (x: number, y: number, z: number): Readonly<CameraOrbitState> =>
  orbitFromOffset(
    x * TOWN_LAYOUT_SCALE * 0.9,
    y * TOWN_LAYOUT_SCALE * 0.84,
    z * TOWN_LAYOUT_SCALE * 0.9,
  );

export const CAMERA_VIEW_PRESETS: Readonly<Record<CameraViewId, CameraViewPreset>> = Object.freeze({
  overview: {
    label: '全镇',
    target: scaleTownVec3([0, 0, 14]),
    orbit: orbitFromTownOffset(38, 32, 46),
  },
  observatory: {
    label: '北街',
    target: scaleTownVec3([0, 1.2, -11]),
    orbit: orbitFromTownOffset(13, 10, 15),
  },
  cavern: {
    label: '南街',
    target: scaleTownVec3([0, 1.1, 11]),
    orbit: orbitFromTownOffset(-13, 9, 15),
  },
  garden: {
    label: '中心广场',
    target: [0, 0.8, 0],
    orbit: orbitFromTownOffset(11, 8, 13),
  },
  crystal: {
    label: '住宅区',
    target: scaleTownVec3([4, 1.2, -14]),
    orbit: orbitFromTownOffset(11, 8, 12),
  },
  ruins: {
    label: '环城路',
    target: scaleTownVec3([-11.5, 0.7, 0]),
    orbit: orbitFromTownOffset(-10, 9, 14),
  },
  harbor: {
    label: '港口工坊',
    target: scaleTownVec3([-23, 2.5, 4.5]),
    orbit: orbitFromTownOffset(-18, 13, 23),
  },
  greenhouse: {
    label: '花园温室',
    target: scaleTownVec3([21, 1.4, 6]),
    orbit: orbitFromTownOffset(11, 8, -13),
  },
  eastDistrict: {
    label: '东部生活街区',
    target: scaleTownVec3([40, 1.2, 0]),
    orbit: orbitFromTownOffset(16, 12, 18),
  },
  southRiverside: {
    label: '南部河岸街区',
    target: scaleTownVec3([0, 1.2, 43]),
    orbit: orbitFromTownOffset(-16, 12, 18),
  },
  westCoast: {
    label: '西部滨海街区',
    target: scaleTownVec3([-44, 1.2, 0]),
    orbit: orbitFromTownOffset(-16, 12, 18),
  },
});

export const CAMERA_TOUR_ORDER: readonly CameraViewId[] = Object.freeze([
  'observatory',
  'cavern',
  'garden',
  'crystal',
  'ruins',
  'harbor',
  'greenhouse',
  'eastDistrict',
  'southRiverside',
  'westCoast',
  'overview',
]);

export const DEFAULT_CAMERA_TOUR_STATE: Readonly<CameraTourState> = Object.freeze({
  enabled: false,
  view: 'overview',
  elapsed: 0,
});

export function getCameraTransitionEase(delta: number, speed: number): number {
  return 1 - Math.exp(-Math.max(0.01, delta) * Math.max(0, speed));
}

export function getCameraTransitionProgress(
  startedAt: number,
  now: number,
  duration: number,
): number {
  if (duration <= 0) return 1;
  return Math.min(1, Math.max(0, (now - startedAt) / duration));
}

export function getNextCameraView(view: CameraViewId): CameraViewId {
  const index = CAMERA_TOUR_ORDER.indexOf(view);
  return CAMERA_TOUR_ORDER[(index + 1) % CAMERA_TOUR_ORDER.length] ?? 'overview';
}

export function setCameraTourEnabled(
  state: Readonly<CameraTourState>,
  enabled: boolean,
): CameraTourState {
  if (!enabled) return { enabled: false, view: state.view, elapsed: 0 };
  if (state.enabled) return { ...state };
  return { enabled: true, view: getNextCameraView(state.view), elapsed: 0 };
}

export function advanceCameraTour(
  state: Readonly<CameraTourState>,
  delta: number,
  interval = 9,
): CameraTourState {
  if (!state.enabled || delta <= 0) return { ...state };
  const safeInterval = Math.max(1, interval);
  let elapsed = state.elapsed + delta;
  let view = state.view;
  while (elapsed >= safeInterval) {
    elapsed -= safeInterval;
    view = getNextCameraView(view);
  }
  return { enabled: true, view, elapsed };
}
