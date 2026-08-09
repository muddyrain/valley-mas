import type { CameraOrbitState } from './camera-orbit';

export type CameraViewId =
  | 'overview'
  | 'observatory'
  | 'cavern'
  | 'garden'
  | 'crystal'
  | 'ruins'
  | 'harbor'
  | 'greenhouse';

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

export const CAMERA_VIEW_PRESETS: Readonly<Record<CameraViewId, CameraViewPreset>> = Object.freeze({
  overview: {
    label: '总览',
    target: [0, -0.7, 0],
    orbit: orbitFromOffset(12.4, 8.1, 21),
  },
  observatory: {
    label: '天文台',
    target: [-5.2, 5.25, -5.8],
    orbit: orbitFromOffset(-10.5, 6.2, -10.5),
  },
  cavern: {
    label: '瀑布洞穴',
    target: [5.8, -4.05, 6],
    orbit: orbitFromOffset(8, 5, 8),
  },
  garden: {
    label: '灯笼庭院',
    target: [8.05, -0.45, 1.12],
    orbit: orbitFromOffset(8.5, 5.5, 7.5),
  },
  crystal: {
    label: '晶石林',
    target: [-7.7, -0.95, 3.45],
    orbit: orbitFromOffset(-8, 5, 8),
  },
  ruins: {
    label: '遗迹水池',
    target: [2.35, -1.25, -8.15],
    orbit: orbitFromOffset(7, 5, -10),
  },
  harbor: {
    label: '空中港口',
    target: [-10.2, 0.55, -2.1],
    orbit: orbitFromOffset(-9, 5.6, 9),
  },
  greenhouse: {
    label: '玻璃温室',
    target: [9.4, 1.65, -5.4],
    orbit: orbitFromOffset(9, 5.4, -9),
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
