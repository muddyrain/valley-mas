import type { TownVec2 } from './town-navigation';

export type NpcRoutine = 'commute' | 'work' | 'leisure' | 'rest';

export interface CrowdAgent {
  id: string;
  position: TownVec2;
  forward?: TownVec2;
  controlled?: boolean;
  unavailable?: boolean;
  moving?: boolean;
}

export function getSocialPairKey(leftId: string, rightId: string): string {
  return leftId < rightId ? `${leftId}:${rightId}` : `${rightId}:${leftId}`;
}

export function getNpcRoutine(timeOfDay: number): NpcRoutine {
  const hour = ((timeOfDay % 24) + 24) % 24;
  if (hour >= 6 && hour < 9) return 'commute';
  if (hour >= 9 && hour < 17) return 'work';
  if (hour >= 17 && hour < 22) return 'leisure';
  return 'rest';
}

export function findSocialEncounter(
  agents: readonly CrowdAgent[],
  maximumDistance = 1.25,
  blockedPairs?: ReadonlySet<string>,
): [string, string] | null {
  let closest: [string, string] | null = null;
  let closestDistance = Math.max(0, maximumDistance);
  for (let leftIndex = 0; leftIndex < agents.length; leftIndex += 1) {
    const left = agents[leftIndex];
    if (!left || left.controlled || left.unavailable || left.moving) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < agents.length; rightIndex += 1) {
      const right = agents[rightIndex];
      if (!right || right.controlled || right.unavailable || right.moving) continue;
      if (blockedPairs?.has(getSocialPairKey(left.id, right.id))) continue;
      const distance = Math.hypot(
        right.position[0] - left.position[0],
        right.position[1] - left.position[1],
      );
      if (distance > closestDistance) continue;
      closestDistance = distance;
      closest = [left.id, right.id];
    }
  }
  return closest;
}

export function resolveCrowdOffsets(
  agents: readonly CrowdAgent[],
  minimumDistance = 0.9,
  movingStationaryDistance = 1.28,
): Record<string, [number, number]> {
  const offsets: Record<string, [number, number]> = Object.fromEntries(
    agents.map((agent) => [agent.id, [0, 0] as [number, number]]),
  );
  for (let leftIndex = 0; leftIndex < agents.length; leftIndex += 1) {
    const left = agents[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < agents.length; rightIndex += 1) {
      const right = agents[rightIndex];
      if (!right) continue;
      const deltaX = right.position[0] - left.position[0];
      const deltaZ = right.position[1] - left.position[1];
      const distance = Math.hypot(deltaX, deltaZ);
      const pairMinimumDistance =
        left.moving !== right.moving ? movingStationaryDistance : minimumDistance;
      if (distance >= pairMinimumDistance) continue;
      if (left.controlled && right.controlled) continue;

      const yielding = left.controlled
        ? right
        : right.controlled
          ? left
          : left.moving !== right.moving
            ? left.moving
              ? left
              : right
            : left.id.localeCompare(right.id) > 0
              ? left
              : right;
      const other = yielding === left ? right : left;
      const fallbackX = other.position[0] - yielding.position[0];
      const fallbackZ = other.position[1] - yielding.position[1];
      const suppliedForward = yielding.forward;
      const forwardLength = Math.hypot(
        suppliedForward?.[0] ?? fallbackX,
        suppliedForward?.[1] ?? fallbackZ,
      );
      const forwardX =
        forwardLength > 0.001 ? (suppliedForward?.[0] ?? fallbackX) / forwardLength : 0;
      const forwardZ =
        forwardLength > 0.001 ? (suppliedForward?.[1] ?? fallbackZ) / forwardLength : 1;
      const requiredLateral = Math.sqrt(
        Math.max(0, pairMinimumDistance * pairMinimumDistance - distance * distance),
      );
      const correction = Math.min(0.72, Math.max(0.12, requiredLateral + 0.04));
      let passingX = forwardZ;
      let passingZ = -forwardX;
      const awayX = yielding.position[0] - other.position[0];
      const awayZ = yielding.position[1] - other.position[1];
      const usesStablePassingSide = Boolean(yielding.moving);
      if (!usesStablePassingSide && passingX * awayX + passingZ * awayZ < -0.001) {
        passingX *= -1;
        passingZ *= -1;
      }

      const sharedAvoidance = Boolean(
        left.moving && right.moving && !left.controlled && !right.controlled,
      );
      const yieldingShare = sharedAvoidance ? correction * 0.5 : correction;
      offsets[yielding.id][0] += passingX * yieldingShare;
      offsets[yielding.id][1] += passingZ * yieldingShare;
      if (sharedAvoidance) {
        offsets[other.id][0] -= passingX * yieldingShare;
        offsets[other.id][1] -= passingZ * yieldingShare;
      }
    }
  }
  return offsets;
}

export function getCrowdTravelScale(
  id: string,
  agents: readonly CrowdAgent[],
  stoppingDistance = 1.05,
  slowingDistance = 1.9,
): number {
  const agent = agents.find((candidate) => candidate.id === id);
  if (!agent?.moving) return 1;
  const forwardLength = Math.max(0.001, Math.hypot(...(agent.forward ?? [0, 1])));
  const forwardX = (agent.forward?.[0] ?? 0) / forwardLength;
  const forwardZ = (agent.forward?.[1] ?? 1) / forwardLength;
  let scale = 1;
  let stationaryConstraint = false;
  for (const other of agents) {
    if (other.id === id || other.unavailable) continue;
    const deltaX = other.position[0] - agent.position[0];
    const deltaZ = other.position[1] - agent.position[1];
    const forwardDistance = deltaX * forwardX + deltaZ * forwardZ;
    const lateralDistance = Math.abs(deltaX * forwardZ - deltaZ * forwardX);
    if (
      forwardDistance <= 0 ||
      forwardDistance >= Math.max(stoppingDistance, slowingDistance) ||
      lateralDistance >= 0.48
    ) {
      continue;
    }
    if (other.moving && id.localeCompare(other.id) < 0) continue;
    stationaryConstraint ||= !other.moving;
    const availableDistance = forwardDistance - Math.max(0, stoppingDistance);
    const brakingRange = Math.max(0.001, slowingDistance - stoppingDistance);
    scale = Math.min(scale, Math.max(0, Math.min(1, availableDistance / brakingRange)));
  }
  if (scale >= 1) return 1;
  return stationaryConstraint ? scale : Math.max(0.12, scale);
}

export function resolveCrowdMovement(
  id: string,
  from: TownVec2,
  to: TownVec2,
  agents: readonly CrowdAgent[],
  minimumDistance = 0.84,
  maximumTravelOverride?: number,
): [number, number] {
  const clearance = Math.max(0, minimumDistance);
  const maximumTravel =
    maximumTravelOverride === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, maximumTravelOverride);
  const resolved: [number, number] = [to[0], to[1]];
  for (const other of agents) {
    if (other.id === id || other.unavailable) continue;
    const deltaX = resolved[0] - other.position[0];
    const deltaZ = resolved[1] - other.position[1];
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance >= clearance) continue;
    let normalX = deltaX;
    let normalZ = deltaZ;
    if (distance < 0.001) {
      const movementX = to[0] - from[0];
      const movementZ = to[1] - from[1];
      const movementLength = Math.hypot(movementX, movementZ);
      if (movementLength > 0.001) {
        const side = id.localeCompare(other.id) < 0 ? -1 : 1;
        normalX = (movementZ / movementLength) * side;
        normalZ = (-movementX / movementLength) * side;
      } else {
        normalX = id.localeCompare(other.id) < 0 ? -1 : 1;
        normalZ = 0;
      }
    } else {
      normalX /= distance;
      normalZ /= distance;
    }
    resolved[0] = other.position[0] + normalX * clearance;
    resolved[1] = other.position[1] + normalZ * clearance;
  }
  const resolvedX = resolved[0] - from[0];
  const resolvedZ = resolved[1] - from[1];
  const resolvedTravel = Math.hypot(resolvedX, resolvedZ);
  if (resolvedTravel <= maximumTravel || resolvedTravel < 0.001) return resolved;
  if (maximumTravel <= 0.001) return [from[0], from[1]];
  const travelScale = maximumTravel / resolvedTravel;
  return [from[0] + resolvedX * travelScale, from[1] + resolvedZ * travelScale];
}

export function stepCrowdOffset(
  current: TownVec2,
  target: TownVec2,
  delta: number,
): [number, number] {
  const targetActive = Math.hypot(...target) > 0.001;
  const ease = Math.min(1, Math.max(0, delta) * (targetActive ? 8 : 1.8));
  return [
    current[0] + (target[0] - current[0]) * ease,
    current[1] + (target[1] - current[1]) * ease,
  ];
}

export function clampCrowdOffset(offset: TownVec2, maximumDistance = 0.68): [number, number] {
  const limit = Math.max(0, maximumDistance);
  const length = Math.hypot(...offset);
  if (length <= limit || length < 0.001) return [offset[0], offset[1]];
  return [(offset[0] / length) * limit, (offset[1] / length) * limit];
}

export function limitCrowdOffsetStep(
  current: TownVec2,
  target: TownVec2,
  maximumStep: number,
): [number, number] {
  const deltaX = target[0] - current[0];
  const deltaZ = target[1] - current[1];
  const distance = Math.hypot(deltaX, deltaZ);
  const limit = Math.max(0, maximumStep);
  if (distance <= limit || distance < 0.001) return [target[0], target[1]];
  return [current[0] + (deltaX / distance) * limit, current[1] + (deltaZ / distance) * limit];
}

export function getCrowdOffsetTarget(
  current: TownVec2,
  avoidance: TownVec2,
  moving: boolean,
): [number, number] {
  if (!moving && Math.hypot(...current) > 0.001) return [current[0], current[1]];
  if (Math.hypot(...avoidance) > 0.001) return [avoidance[0], avoidance[1]];
  return [0, 0];
}

export function pickClearestCrowdPosition(
  candidates: readonly [TownVec2, TownVec2],
  otherPositions: readonly TownVec2[],
  preferredIndex: 0 | 1 = 0,
  switchClearanceMargin = 0,
): [number, number] {
  const clearance = (candidate: TownVec2) =>
    Math.min(
      ...otherPositions.map((other) =>
        Math.hypot(candidate[0] - other[0], candidate[1] - other[1]),
      ),
    );
  const alternativeIndex = preferredIndex === 0 ? 1 : 0;
  const preferred = candidates[preferredIndex];
  const alternative = candidates[alternativeIndex];
  const preferredClearance = clearance(preferred);
  const alternativeClearance = clearance(alternative);
  const selected =
    alternativeClearance > preferredClearance + Math.max(0, switchClearanceMargin)
      ? alternative
      : preferred;
  return [selected[0], selected[1]];
}

export function pickCrowdPassingPosition(
  candidates: readonly [TownVec2, TownVec2],
  origin: TownVec2,
  requestedDistance: number,
  otherPositions: readonly TownVec2[],
  switchClearanceMargin = 0.12,
): [number, number] {
  const travel = (candidate: TownVec2) =>
    Math.hypot(candidate[0] - origin[0], candidate[1] - origin[1]);
  const preferredTravel = travel(candidates[0]);
  const alternativeTravel = travel(candidates[1]);
  if (
    preferredTravel < Math.max(0, requestedDistance) * 0.72 &&
    alternativeTravel > preferredTravel + 0.16
  ) {
    return [candidates[1][0], candidates[1][1]];
  }
  return pickClearestCrowdPosition(candidates, otherPositions, 0, switchClearanceMargin);
}

export function getPedestrianBrakeScale(
  vehiclePosition: TownVec2,
  heading: number,
  pedestrians: readonly TownVec2[],
): number {
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  let scale = 1;
  for (const position of pedestrians) {
    const deltaX = position[0] - vehiclePosition[0];
    const deltaZ = position[1] - vehiclePosition[1];
    if (deltaX * deltaX + deltaZ * deltaZ <= 1.75 * 1.75) return 0;
    const forwardDistance = deltaX * forwardX + deltaZ * forwardZ;
    const lateralDistance = Math.abs(deltaX * forwardZ - deltaZ * forwardX);
    if (forwardDistance <= 0 || forwardDistance >= 5.5 || lateralDistance >= 1.55) continue;
    scale = Math.min(scale, Math.max(0, (forwardDistance - 2.6) / 2.9));
  }
  return scale;
}
