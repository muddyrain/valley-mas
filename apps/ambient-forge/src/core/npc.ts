import { clamp } from './ambient-inputs';

export type NpcId = 'traveler' | 'mechanic' | 'gardener';
export type NpcActivity = 'walking' | 'idle' | 'observing' | 'working';
export type NpcViewMode = 'orbit' | 'follow' | 'pov';
export type NpcVec3 = readonly [number, number, number];

export interface NpcProfile {
  id: NpcId;
  name: string;
  role: string;
}

export interface NpcRouteNode {
  position: NpcVec3;
  activity?: Exclude<NpcActivity, 'walking'>;
  waitSeconds?: number;
}

export interface NpcRoute {
  speed: number;
  nodes: readonly NpcRouteNode[];
}

export interface NpcEnvironment {
  rain: number;
  snow: number;
  daylight: number;
}

export interface NpcRuntimeState {
  id: NpcId;
  segmentIndex: number;
  segmentProgress: number;
  activity: NpcActivity;
  activityRemaining: number;
  position: [number, number, number];
  forward: [number, number, number];
  gaitPhase: number;
}

export interface NpcSnapshot {
  id: NpcId;
  name: string;
  role: string;
  activity: NpcActivity;
  position: [number, number, number];
  forward: [number, number, number];
  gaitPhase: number;
}

export interface NpcCameraState {
  npcId: NpcId | null;
  mode: NpcViewMode;
}

export interface NpcCameraPose {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}

export const NPC_PROFILES: readonly NpcProfile[] = Object.freeze([
  { id: 'traveler', name: '岚', role: '主岛旅人' },
  { id: 'mechanic', name: '铆钉', role: '港口工匠' },
  { id: 'gardener', name: '苔芽', role: '温室园丁' },
]);

export const DEFAULT_NPC_CAMERA_STATE: Readonly<NpcCameraState> = Object.freeze({
  npcId: null,
  mode: 'orbit',
});

const getProfile = (id: NpcId): NpcProfile =>
  NPC_PROFILES.find((profile) => profile.id === id) ?? NPC_PROFILES[0];

const getNode = (route: Readonly<NpcRoute>, index: number): NpcRouteNode =>
  route.nodes[((index % route.nodes.length) + route.nodes.length) % route.nodes.length] ?? {
    position: [0, 0, 0],
  };

const distance = (from: NpcVec3, to: NpcVec3): number =>
  Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]);

const direction = (from: NpcVec3, to: NpcVec3): [number, number, number] => {
  const length = distance(from, to);
  if (length <= 0.0001) return [0, 0, 1];
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length, (to[2] - from[2]) / length];
};

const interpolate = (from: NpcVec3, to: NpcVec3, amount: number): [number, number, number] => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
];

export function createNpcRuntimeState(id: NpcId, route: Readonly<NpcRoute>): NpcRuntimeState {
  const first = getNode(route, 0);
  const second = getNode(route, 1);
  return {
    id,
    segmentIndex: 0,
    segmentProgress: 0,
    activity: 'walking',
    activityRemaining: 0,
    position: [...first.position],
    forward: direction(first.position, second.position),
    gaitPhase: 0,
  };
}

export function stepNpcRuntime(
  current: Readonly<NpcRuntimeState>,
  route: Readonly<NpcRoute>,
  environment: Readonly<NpcEnvironment>,
  deltaSeconds: number,
): NpcRuntimeState {
  if (route.nodes.length < 2 || deltaSeconds <= 0) {
    return { ...current, position: [...current.position], forward: [...current.forward] };
  }

  let delta = Math.max(0, deltaSeconds);
  let activity = current.activity;
  let activityRemaining = current.activityRemaining;
  let segmentIndex = current.segmentIndex;
  let segmentProgress = current.segmentProgress;
  let position: [number, number, number] = [...current.position];
  let forward: [number, number, number] = [...current.forward];
  let gaitPhase = current.gaitPhase;

  if (activity !== 'walking') {
    if (delta < activityRemaining) {
      return {
        ...current,
        activityRemaining: activityRemaining - delta,
        position,
        forward,
      };
    }
    delta -= activityRemaining;
    activity = 'walking';
    activityRemaining = 0;
  }

  const weatherScale = clamp(1 - environment.rain * 0.24 - environment.snow * 0.34, 0.36, 1);
  const daylightScale = 0.72 + clamp(environment.daylight) * 0.28;
  const speed = Math.max(0.05, route.speed * weatherScale * daylightScale);
  let travel = speed * delta;
  let safety = route.nodes.length * 2;

  while (travel > 0.0001 && safety > 0) {
    safety -= 1;
    const from = getNode(route, segmentIndex);
    const nextIndex = (segmentIndex + 1) % route.nodes.length;
    const to = getNode(route, nextIndex);
    const segmentLength = Math.max(0.0001, distance(from.position, to.position));
    const remainingDistance = segmentLength * (1 - segmentProgress);
    forward = direction(from.position, to.position);

    if (travel < remainingDistance) {
      const moved = travel;
      segmentProgress += moved / segmentLength;
      position = interpolate(from.position, to.position, segmentProgress);
      gaitPhase = (gaitPhase + moved * 5.4) % (Math.PI * 2);
      travel = 0;
      break;
    }

    travel -= remainingDistance;
    gaitPhase = (gaitPhase + remainingDistance * 5.4) % (Math.PI * 2);
    segmentIndex = nextIndex;
    segmentProgress = 0;
    position = [...to.position];
    if (to.activity && (to.waitSeconds ?? 0) > 0) {
      activity = to.activity;
      activityRemaining = Math.max(0, (to.waitSeconds ?? 0) - travel / speed);
      travel = 0;
    }
  }

  return {
    id: current.id,
    segmentIndex,
    segmentProgress,
    activity,
    activityRemaining,
    position,
    forward,
    gaitPhase,
  };
}

export function createNpcSnapshot(state: Readonly<NpcRuntimeState>): NpcSnapshot {
  const profile = getProfile(state.id);
  return {
    id: state.id,
    name: profile.name,
    role: profile.role,
    activity: state.activity,
    position: [...state.position],
    forward: [...state.forward],
    gaitPhase: state.gaitPhase,
  };
}

export function getNpcCameraPose(
  snapshot: Readonly<NpcSnapshot>,
  mode: Exclude<NpcViewMode, 'orbit'>,
): NpcCameraPose {
  const [x, y, z] = snapshot.position;
  const [forwardX, , forwardZ] = snapshot.forward;
  if (mode === 'pov') {
    return {
      position: [x + forwardX * 0.28, y + 1.5, z + forwardZ * 0.28],
      target: [x + forwardX * 4.6, y + 1.53, z + forwardZ * 4.6],
      fov: 51,
    };
  }
  return {
    position: [
      x - forwardX * 4.2 + forwardZ * 0.95,
      y + 3.35,
      z - forwardZ * 4.2 - forwardX * 0.95,
    ],
    target: [x + forwardX * 0.72, y + 1.08, z + forwardZ * 0.72],
    fov: 38,
  };
}

export function selectNpc(_state: Readonly<NpcCameraState>, npcId: NpcId): NpcCameraState {
  return { npcId, mode: 'follow' };
}

export function setNpcViewMode(
  state: Readonly<NpcCameraState>,
  mode: Exclude<NpcViewMode, 'orbit'>,
): NpcCameraState {
  if (!state.npcId) return { npcId: null, mode: 'orbit' };
  return { npcId: state.npcId, mode };
}

export function exitNpcView(): NpcCameraState {
  return { npcId: null, mode: 'orbit' };
}
