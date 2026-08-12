import type { NpcId } from './npc';

export type WorldControlMode = 'resident' | 'vehicle';
export type VehicleId =
  | 'copper'
  | 'sage'
  | 'cream'
  | 'navy'
  | 'amber'
  | 'teal'
  | 'rose'
  | 'slate'
  | 'sand';
export const PLAYER_RESIDENT_ID: NpcId = 'traveler';
export const PLAYER_SPAWN_POSITION: [number, number, number] = [7.02, 0.22, -7.02];
export const PLAYER_SPAWN_FORWARD: [number, number, number] = [0, 0, -1];

export interface WorldControlState {
  mode: WorldControlMode;
  residentId: NpcId | null;
  vehicleId: VehicleId | null;
}

export type WorldControlEvent =
  | { type: 'possess-resident'; residentId: NpcId }
  | { type: 'enter-vehicle'; vehicleId: VehicleId }
  | { type: 'exit-vehicle' }
  | { type: 'release-control' };

export type WorldControlEffect =
  | { type: 'resume-npc'; residentId: NpcId }
  | { type: 'autopark-vehicle'; vehicleId: VehicleId };

export interface WorldControlTransition {
  state: WorldControlState;
  effects: WorldControlEffect[];
}

export interface VehicleDriverDoorPose {
  outside: [number, number, number];
  inside: [number, number, number];
  enterForward: [number, number, number];
  exitForward: [number, number, number];
}

export interface ClosestVehicleDoorPose {
  side: 'left' | 'right';
  pose: VehicleDriverDoorPose;
}

export interface VehicleDriverDoorApproach {
  pose: VehicleDriverDoorPose;
  waypoints: [number, number, number][];
}

export const createWorldControlState = (): WorldControlState => ({
  mode: 'resident',
  residentId: PLAYER_RESIDENT_ID,
  vehicleId: null,
});

export function getCameraRelativeResidentMovement(
  cameraForward: readonly [number, number],
  forwardInput: number,
  sideInput: number,
): [number, number] {
  const length = Math.hypot(cameraForward[0], cameraForward[1]);
  if (length < 0.0001) return [0, 0];
  const forwardX = cameraForward[0] / length;
  const forwardZ = cameraForward[1] / length;
  return [
    forwardX * forwardInput - forwardZ * sideInput,
    forwardZ * forwardInput + forwardX * sideInput,
  ];
}

export function getResidentMovementBasis(
  current: readonly [number, number] | null,
  cameraForward: readonly [number, number],
  hasMovementInput: boolean,
  cameraIsOrbiting: boolean,
): [number, number] | null {
  if (!hasMovementInput) return null;
  if (current && !cameraIsOrbiting) return [current[0], current[1]];
  const length = Math.hypot(cameraForward[0], cameraForward[1]);
  if (length < 0.0001) return current ? [current[0], current[1]] : null;
  return [cameraForward[0] / length, cameraForward[1] / length];
}

function getVehicleDoorPose(
  vehiclePosition: readonly [number, number, number],
  heading: number,
  side: 'left' | 'right',
): VehicleDriverDoorPose {
  const rawRightX = Math.cos(heading);
  const rawRightZ = -Math.sin(heading);
  const rightX = Math.abs(rawRightX) < 1e-10 ? 0 : rawRightX;
  const rightZ = Math.abs(rawRightZ) < 1e-10 ? 0 : rawRightZ;
  const sideDirection = side === 'left' ? -1 : 1;
  const enterDirection = -sideDirection;
  const clean = (value: number) => (Math.abs(value) < 1e-10 ? 0 : value);
  return {
    outside: [
      vehiclePosition[0] + rightX * sideDirection * 1.58,
      0.22,
      vehiclePosition[2] + rightZ * sideDirection * 1.58,
    ],
    inside: [
      vehiclePosition[0] + rightX * sideDirection * 0.42,
      0.22,
      vehiclePosition[2] + rightZ * sideDirection * 0.42,
    ],
    enterForward: [clean(rightX * enterDirection), 0, clean(rightZ * enterDirection)],
    exitForward: [clean(rightX * sideDirection), 0, clean(rightZ * sideDirection)],
  };
}

export const getVehicleDriverDoorPose = (
  vehiclePosition: readonly [number, number, number],
  heading: number,
): VehicleDriverDoorPose => getVehicleDoorPose(vehiclePosition, heading, 'left');

export function getVehicleDriverDoorApproach(
  vehiclePosition: readonly [number, number, number],
  heading: number,
  residentPosition: readonly [number, number, number],
): VehicleDriverDoorApproach {
  const pose = getVehicleDriverDoorPose(vehiclePosition, heading);
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);
  const offsetX = residentPosition[0] - vehiclePosition[0];
  const offsetZ = residentPosition[2] - vehiclePosition[2];
  const residentSide = offsetX * rightX + offsetZ * rightZ;
  if (residentSide <= 0.2) return { pose, waypoints: [] };

  const residentLongitudinal = offsetX * forwardX + offsetZ * forwardZ;
  const endDirection = residentLongitudinal >= 0 ? 1 : -1;
  const sideClearance = 1.72;
  const endClearance = 2.2;
  const waypoint = (sideDirection: number): [number, number, number] => [
    vehiclePosition[0] +
      rightX * sideDirection * sideClearance +
      forwardX * endDirection * endClearance,
    0.22,
    vehiclePosition[2] +
      rightZ * sideDirection * sideClearance +
      forwardZ * endDirection * endClearance,
  ];
  return { pose, waypoints: [waypoint(1), waypoint(-1)] };
}

export function getClosestVehicleDoorPose(
  vehiclePosition: readonly [number, number, number],
  heading: number,
  residentPosition: readonly [number, number, number],
): ClosestVehicleDoorPose {
  const left = getVehicleDoorPose(vehiclePosition, heading, 'left');
  const right = getVehicleDoorPose(vehiclePosition, heading, 'right');
  const distanceTo = (pose: VehicleDriverDoorPose) =>
    Math.hypot(residentPosition[0] - pose.outside[0], residentPosition[2] - pose.outside[2]);
  return distanceTo(left) <= distanceTo(right)
    ? { side: 'left', pose: left }
    : { side: 'right', pose: right };
}

export function transitionWorldControl(
  current: Readonly<WorldControlState>,
  event: WorldControlEvent,
): WorldControlTransition {
  const effects: WorldControlEffect[] = [];

  if (event.type === 'possess-resident' || event.type === 'release-control') {
    return { state: { ...current }, effects };
  }

  if (event.type === 'enter-vehicle') {
    if (current.mode !== 'resident' || !current.residentId) {
      return { state: { ...current }, effects };
    }
    return {
      state: {
        mode: 'vehicle',
        residentId: current.residentId,
        vehicleId: event.vehicleId,
      },
      effects,
    };
  }

  if (event.type === 'exit-vehicle') {
    if (current.mode !== 'vehicle' || !current.residentId) {
      return { state: { ...current }, effects };
    }
    return {
      state: { mode: 'resident', residentId: current.residentId, vehicleId: null },
      effects,
    };
  }

  return { state: { ...current }, effects };
}
