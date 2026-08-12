import { clamp } from './ambient-inputs';
import type { NpcRoutine } from './town-life';
import type { WorldEventAction } from './world-events';

export type NpcId =
  | 'traveler'
  | 'mechanic'
  | 'gardener'
  | 'baker'
  | 'courier'
  | 'student'
  | 'harborhand'
  | 'florist'
  | 'photographer'
  | 'retiree'
  | 'barista'
  | 'ranger'
  | 'shopkeeper'
  | 'nurse'
  | 'teacher'
  | 'fisher'
  | 'groundskeeper'
  | 'musician';
export type NpcActivity = 'walking' | 'idle' | 'observing' | 'working';
export type NpcMotion =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'vault'
  | 'entering'
  | 'driving'
  | 'exiting'
  | 'greet';
export type NpcViewMode = 'orbit' | 'follow' | 'pov';
export type NpcReaction = 'none' | 'nod' | 'wave' | 'approach' | 'follow' | 'yield' | 'celebrate';
export type NpcVec3 = readonly [number, number, number];

export interface NpcProfile {
  id: NpcId;
  name: string;
  role: string;
}

export interface NpcRouteNode {
  position: NpcVec3;
  stopId?: string;
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
  motion: NpcMotion;
  routine: NpcRoutine;
  task: string;
  taskAction: WorldEventAction | null;
  reaction: NpcReaction;
  socialPartner: NpcId | null;
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

export interface NpcRoutePoint {
  segmentIndex: number;
  segmentProgress: number;
  position: [number, number, number];
  forward: [number, number, number];
  distance: number;
}

export const NPC_PROFILES: readonly NpcProfile[] = Object.freeze([
  { id: 'traveler', name: '岚', role: '广场居民' },
  { id: 'mechanic', name: '铆钉', role: '港口技师' },
  { id: 'gardener', name: '苔芽', role: '温室园丁' },
  { id: 'baker', name: '麦穗', role: '面包师' },
  { id: 'courier', name: '飞羽', role: '镇区邮差' },
  { id: 'student', name: '小满', role: '见习生' },
  { id: 'harborhand', name: '泊舟', role: '港口工人' },
  { id: 'florist', name: '鸢尾', role: '花艺师' },
  { id: 'photographer', name: '青禾', role: '摄影师' },
  { id: 'retiree', name: '松伯', role: '退休居民' },
  { id: 'barista', name: '栗子', role: '咖啡师' },
  { id: 'ranger', name: '岩雀', role: '巡镇员' },
  { id: 'shopkeeper', name: '榆钱', role: '旧城店主' },
  { id: 'nurse', name: '白芷', role: '山地护士' },
  { id: 'teacher', name: '墨羽', role: '溪谷教师' },
  { id: 'fisher', name: '潮生', role: '港湾渔夫' },
  { id: 'groundskeeper', name: '青萝', role: '公园养护员' },
  { id: 'musician', name: '弦月', role: '街头乐手' },
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

export function getNpcRouteLookaheadForward(
  route: Readonly<NpcRoute>,
  segmentIndex: number,
  segmentProgress: number,
  lookaheadDistance = 0.85,
): [number, number, number] {
  if (route.nodes.length < 2) return [0, 0, 1];
  let currentSegment = segmentIndex;
  const progress = clamp(segmentProgress);
  const segmentStart = getNode(route, currentSegment).position;
  const segmentEnd = getNode(route, currentSegment + 1).position;
  const origin = interpolate(segmentStart, segmentEnd, progress);
  let cursor: [number, number, number] = [...origin];
  let remainingLookahead = Math.max(0.05, lookaheadDistance);
  let safety = route.nodes.length * 2;

  while (remainingLookahead > 0.0001 && safety > 0) {
    safety -= 1;
    const targetNode = getNode(route, currentSegment + 1);
    const target = targetNode.position;
    const remainingSegment = distance(cursor, target);
    if (remainingSegment > remainingLookahead) {
      const lookaheadPoint = interpolate(cursor, target, remainingLookahead / remainingSegment);
      return direction(origin, lookaheadPoint);
    }
    cursor = [...target];
    if (targetNode.activity && (targetNode.waitSeconds ?? 0) > 0) {
      return direction(origin, cursor);
    }
    remainingLookahead -= remainingSegment;
    currentSegment = (currentSegment + 1) % route.nodes.length;
  }
  return direction(origin, cursor);
}

export function getClosestNpcRoutePoint(
  route: Readonly<NpcRoute>,
  position: NpcVec3,
  preferredSegmentIndex?: number,
): NpcRoutePoint {
  if (route.nodes.length < 2) {
    return {
      segmentIndex: 0,
      segmentProgress: 0,
      position: [...position],
      forward: [0, 0, 1],
      distance: 0,
    };
  }
  let closest: NpcRoutePoint | null = null;
  let closestScore = Number.POSITIVE_INFINITY;
  for (let segmentIndex = 0; segmentIndex < route.nodes.length; segmentIndex += 1) {
    const from = getNode(route, segmentIndex).position;
    const to = getNode(route, segmentIndex + 1).position;
    const segmentX = to[0] - from[0];
    const segmentZ = to[2] - from[2];
    const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
    const segmentProgress =
      lengthSquared > 0.0001
        ? clamp(
            ((position[0] - from[0]) * segmentX + (position[2] - from[2]) * segmentZ) /
              lengthSquared,
          )
        : 0;
    const projected = interpolate(from, to, segmentProgress);
    const projectionDistance = Math.hypot(position[0] - projected[0], position[2] - projected[2]);
    const indexDifference =
      preferredSegmentIndex === undefined
        ? 0
        : Math.min(
            Math.abs(segmentIndex - preferredSegmentIndex),
            route.nodes.length - Math.abs(segmentIndex - preferredSegmentIndex),
          );
    const score = projectionDistance + Math.min(0.18, indexDifference * 0.02);
    if (score >= closestScore) continue;
    closestScore = score;
    closest = {
      segmentIndex,
      segmentProgress,
      position: projected,
      forward: direction(from, to),
      distance: projectionDistance,
    };
  }
  return (
    closest ?? {
      segmentIndex: 0,
      segmentProgress: 0,
      position: [...position],
      forward: [0, 0, 1],
      distance: 0,
    }
  );
}

export function createNpcRuntimeState(
  id: NpcId,
  route: Readonly<NpcRoute>,
  initialProgress = 0,
): NpcRuntimeState {
  const segmentLengths = route.nodes.map((node, index) =>
    distance(node.position, getNode(route, index + 1).position),
  );
  const routeLength = segmentLengths.reduce((total, length) => total + length, 0);
  const normalizedProgress = ((initialProgress % 1) + 1) % 1;
  let remainingDistance = normalizedProgress * routeLength;
  let segmentIndex = 0;
  while (
    segmentIndex < Math.max(0, route.nodes.length - 1) &&
    remainingDistance >= (segmentLengths[segmentIndex] ?? 0) - 0.0001
  ) {
    remainingDistance -= segmentLengths[segmentIndex] ?? 0;
    segmentIndex += 1;
  }
  const first = getNode(route, segmentIndex);
  const second = getNode(route, segmentIndex + 1);
  const segmentLength = Math.max(0.0001, segmentLengths[segmentIndex] ?? 0);
  const segmentProgress = Math.max(0, Math.min(1, remainingDistance / segmentLength));
  return {
    id,
    segmentIndex,
    segmentProgress,
    activity: 'walking',
    activityRemaining: 0,
    position: interpolate(first.position, second.position, segmentProgress),
    forward: direction(first.position, second.position),
    gaitPhase: (normalizedProgress * routeLength * 5.4) % (Math.PI * 2),
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

  if (activity === 'walking') {
    forward = getNpcRouteLookaheadForward(
      route,
      segmentIndex,
      segmentProgress,
      Math.max(0.6, Math.min(1.05, speed * 0.65)),
    );
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

export function createNpcSnapshot(
  state: Readonly<NpcRuntimeState>,
  motion: NpcMotion = state.activity === 'walking' ? 'walk' : 'idle',
  routine: NpcRoutine = 'work',
  socialPartner: NpcId | null = null,
  task = '日常活动',
  taskAction: WorldEventAction | null = null,
  reaction: NpcReaction = 'none',
): NpcSnapshot {
  const profile = getProfile(state.id);
  return {
    id: state.id,
    name: profile.name,
    role: profile.role,
    activity: state.activity,
    motion,
    routine,
    task,
    taskAction,
    reaction,
    socialPartner,
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
    position: [x - forwardX * 4.6, y + 3.42, z - forwardZ * 4.6],
    target: [x + forwardX * 0.9, y + 1.12, z + forwardZ * 0.9],
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
