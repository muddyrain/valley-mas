import type { NavigationGraph, TownVec2 } from './town-navigation';

export interface TrafficVehicleState {
  id: string;
  position: TownVec2;
  heading: number;
  speed: number;
  parked?: boolean;
  controlled?: boolean;
}

export interface TrafficLaneDecision {
  mode: 'right' | 'passing';
  blockerId: string | null;
  obstacleId: string | null;
}

export interface IntersectionYieldDecision {
  intersectionId: string | null;
  hasPriority: boolean;
  speedScale: number;
}

export interface OrientedVehicleFootprint {
  position: TownVec2;
  heading: number;
}

export interface VehicleOverlapCorrection {
  axis: [number, number];
  depth: number;
}

export function getOrientedVehicleOverlap(
  left: Readonly<OrientedVehicleFootprint>,
  right: Readonly<OrientedVehicleFootprint>,
  margin = 0.08,
): VehicleOverlapCorrection | null {
  const halfWidth = 0.88;
  const halfLength = 1.5;
  const leftAxes: readonly [TownVec2, TownVec2] = [
    [Math.cos(left.heading), -Math.sin(left.heading)],
    [Math.sin(left.heading), Math.cos(left.heading)],
  ];
  const rightAxes: readonly [TownVec2, TownVec2] = [
    [Math.cos(right.heading), -Math.sin(right.heading)],
    [Math.sin(right.heading), Math.cos(right.heading)],
  ];
  const centerDelta: TownVec2 = [
    right.position[0] - left.position[0],
    right.position[1] - left.position[1],
  ];
  let correction: VehicleOverlapCorrection | null = null;
  for (const axis of [...leftAxes, ...rightAxes]) {
    const projectRadius = (axes: readonly [TownVec2, TownVec2]): number =>
      Math.abs(axes[0][0] * axis[0] + axes[0][1] * axis[1]) * halfWidth +
      Math.abs(axes[1][0] * axis[0] + axes[1][1] * axis[1]) * halfLength;
    const projectedDistance = centerDelta[0] * axis[0] + centerDelta[1] * axis[1];
    const overlap =
      projectRadius(leftAxes) +
      projectRadius(rightAxes) +
      Math.max(0, margin) -
      Math.abs(projectedDistance);
    if (overlap <= 0) return null;
    if (correction && overlap >= correction.depth) continue;
    const direction = projectedDistance < 0 ? -1 : 1;
    correction = {
      axis: [axis[0] * direction, axis[1] * direction],
      depth: overlap,
    };
  }
  return correction;
}

export function clampVehicleAdvance(
  from: TownVec2,
  proposed: TownVec2,
  otherVehicles: readonly TownVec2[],
  minimumDistance = 2.6,
  allowDetour = false,
): TownVec2 {
  const isSafe = (candidate: TownVec2): boolean =>
    otherVehicles.every(
      (other) => Math.hypot(other[0] - candidate[0], other[1] - candidate[1]) >= minimumDistance,
    );
  if (isSafe(proposed)) return [proposed[0], proposed[1]];
  if (!isSafe(from)) return [from[0], from[1]];

  let safeProgress = 0;
  let blockedProgress = 1;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const progress = (safeProgress + blockedProgress) * 0.5;
    const candidate: TownVec2 = [
      from[0] + (proposed[0] - from[0]) * progress,
      from[1] + (proposed[1] - from[1]) * progress,
    ];
    if (isSafe(candidate)) safeProgress = progress;
    else blockedProgress = progress;
  }
  const safePoint: TownVec2 = [
    from[0] + (proposed[0] - from[0]) * safeProgress,
    from[1] + (proposed[1] - from[1]) * safeProgress,
  ];
  if (!allowDetour) return safePoint;
  const blocker = otherVehicles.reduce<TownVec2 | null>((nearest, other) => {
    if (!nearest) return other;
    return Math.hypot(other[0] - safePoint[0], other[1] - safePoint[1]) <
      Math.hypot(nearest[0] - safePoint[0], nearest[1] - safePoint[1])
      ? other
      : nearest;
  }, null);
  if (!blocker) return safePoint;

  const radialX = safePoint[0] - blocker[0];
  const radialZ = safePoint[1] - blocker[1];
  const radialLength = Math.max(0.001, Math.hypot(radialX, radialZ));
  const normalX = radialX / radialLength;
  const normalZ = radialZ / radialLength;
  const remainingX = proposed[0] - safePoint[0];
  const remainingZ = proposed[1] - safePoint[1];
  const inward = remainingX * normalX + remainingZ * normalZ;
  if (inward >= 0) return safePoint;
  const tangentX = -normalZ;
  const tangentZ = normalX;
  const projectedX = remainingX - normalX * inward;
  const projectedZ = remainingZ - normalZ * inward;
  const projectedLength = Math.hypot(projectedX, projectedZ);
  const remainingLength = Math.hypot(remainingX, remainingZ);
  const detourDirection =
    projectedLength > 0.001
      ? [projectedX / projectedLength, projectedZ / projectedLength]
      : [tangentX, tangentZ];
  const slide: TownVec2 = [
    safePoint[0] + detourDirection[0] * remainingLength,
    safePoint[1] + detourDirection[1] * remainingLength,
  ];
  return isSafe(slide) ? slide : safePoint;
}

export function getRightHandLaneTarget(from: TownVec2, to: TownVec2, laneOffset: number): TownVec2 {
  const deltaX = to[0] - from[0];
  const deltaZ = to[1] - from[1];
  const length = Math.hypot(deltaX, deltaZ);
  if (length < 0.0001) return [to[0], to[1]];
  const directionX = deltaX / length;
  const directionZ = deltaZ / length;
  return [to[0] - directionZ * laneOffset, to[1] + directionX * laneOffset];
}

export function getRightHandLaneJunctionTarget(
  previous: TownVec2,
  current: TownVec2,
  next: TownVec2,
  laneOffset: number,
): TownVec2 {
  const incomingX = current[0] - previous[0];
  const incomingZ = current[1] - previous[1];
  const outgoingX = next[0] - current[0];
  const outgoingZ = next[1] - current[1];
  const incomingLength = Math.hypot(incomingX, incomingZ);
  const outgoingLength = Math.hypot(outgoingX, outgoingZ);
  if (incomingLength < 0.0001 || outgoingLength < 0.0001) {
    return getRightHandLaneTarget(previous, current, laneOffset);
  }
  const incomingNormal: TownVec2 = [-incomingZ / incomingLength, incomingX / incomingLength];
  const outgoingNormal: TownVec2 = [-outgoingZ / outgoingLength, outgoingX / outgoingLength];
  const miterX = incomingNormal[0] + outgoingNormal[0];
  const miterZ = incomingNormal[1] + outgoingNormal[1];
  const miterLength = Math.hypot(miterX, miterZ);
  if (miterLength < 0.0001) return getRightHandLaneTarget(previous, current, laneOffset);
  const normalizedMiter: TownVec2 = [miterX / miterLength, miterZ / miterLength];
  const projection =
    normalizedMiter[0] * incomingNormal[0] + normalizedMiter[1] * incomingNormal[1];
  if (Math.abs(projection) < 0.2) return getRightHandLaneTarget(previous, current, laneOffset);
  const maximumMiter = Math.abs(laneOffset) * 1.6;
  const miterScale = Math.max(-maximumMiter, Math.min(maximumMiter, laneOffset / projection));
  return [
    current[0] + normalizedMiter[0] * miterScale,
    current[1] + normalizedMiter[1] * miterScale,
  ];
}

export function getRightHandLaneWaypoints(
  centerline: readonly TownVec2[],
  laneOffset: number,
): TownVec2[] {
  return centerline.slice(1).map((target, index) => {
    const previous = centerline[index] ?? target;
    const next = centerline[index + 2];
    return next
      ? getRightHandLaneJunctionTarget(previous, target, next, laneOffset)
      : getRightHandLaneTarget(previous, target, laneOffset);
  });
}

export function getTrafficLaneDecision(
  vehiclePosition: TownVec2,
  heading: number,
  otherVehicles: readonly TrafficVehicleState[],
  activeBlockerId: string | null,
): TrafficLaneDecision {
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  const relativePosition = (other: TrafficVehicleState) => {
    const deltaX = other.position[0] - vehiclePosition[0];
    const deltaZ = other.position[1] - vehiclePosition[1];
    return {
      forward: deltaX * forwardX + deltaZ * forwardZ,
      lateral: Math.abs(deltaX * forwardZ - deltaZ * forwardX),
    };
  };
  const canPassAsStationaryObstacle = (vehicle: TrafficVehicleState): boolean =>
    vehicle.parked ?? Math.abs(vehicle.speed) <= 0.2;
  const forwardVehicles = otherVehicles
    .map((vehicle) => ({ vehicle, relative: relativePosition(vehicle) }))
    .filter(({ relative }) => relative.forward >= 0.5 && relative.forward <= 7.5)
    .filter(({ relative }) => relative.lateral <= 2.2)
    .sort((left, right) => left.relative.forward - right.relative.forward);
  const decidePassing = (blocker: TrafficVehicleState): TrafficLaneDecision => {
    const hasOncomingTraffic = otherVehicles.some((vehicle) => {
      if (vehicle.id === blocker.id) return false;
      const relative = relativePosition(vehicle);
      const headingDot = Math.cos(vehicle.heading - heading);
      const oncomingLookahead = 13 + Math.min(6, Math.abs(vehicle.speed) * 1.1);
      return (
        headingDot < -0.35 &&
        relative.forward >= 0.5 &&
        relative.forward <= oncomingLookahead &&
        relative.lateral <= 3.4
      );
    });
    return hasOncomingTraffic
      ? { mode: 'right', blockerId: null, obstacleId: blocker.id }
      : { mode: 'passing', blockerId: blocker.id, obstacleId: blocker.id };
  };

  if (activeBlockerId) {
    const blocker = otherVehicles.find((vehicle) => vehicle.id === activeBlockerId);
    if (blocker) {
      const relative = relativePosition(blocker);
      if (relative.forward >= -2.6) return decidePassing(blocker);
    }
  }

  const obstacle = forwardVehicles.find(({ vehicle }) =>
    canPassAsStationaryObstacle(vehicle),
  )?.vehicle;
  if (!obstacle) {
    return {
      mode: 'right',
      blockerId: null,
      obstacleId: forwardVehicles[0]?.vehicle.id ?? null,
    };
  }
  return decidePassing(obstacle);
}

export function getIntersectionSpeedScale(
  position: TownVec2,
  graph: Readonly<NavigationGraph>,
): number {
  let scale = 1;
  for (const node of graph.nodes) {
    if (node.neighbors.length < 3) continue;
    const distance = Math.hypot(node.position[0] - position[0], node.position[1] - position[1]);
    if (distance >= 4.5) continue;
    scale = Math.min(scale, 0.48 + Math.max(0, distance - 1.2) * 0.16);
  }
  return Math.max(0.48, Math.min(1, scale));
}

export function getIntersectionYieldDecision(
  vehicle: Readonly<TrafficVehicleState>,
  otherVehicles: readonly TrafficVehicleState[],
  graph: Readonly<NavigationGraph>,
): IntersectionYieldDecision {
  const forwardX = Math.sin(vehicle.heading);
  const forwardZ = Math.cos(vehicle.heading);
  const intersection = graph.nodes
    .filter((node) => node.neighbors.length >= 3)
    .map((node) => {
      const deltaX = node.position[0] - vehicle.position[0];
      const deltaZ = node.position[1] - vehicle.position[1];
      return {
        node,
        distance: Math.hypot(deltaX, deltaZ),
        forward: deltaX * forwardX + deltaZ * forwardZ,
      };
    })
    .filter(({ distance, forward }) => distance <= 7 && forward >= -2.5)
    .sort((left, right) => left.distance - right.distance)[0];
  if (!intersection) {
    return { intersectionId: null, hasPriority: true, speedScale: 1 };
  }

  const candidates = [vehicle, ...otherVehicles]
    .filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
    .filter((candidate) => !candidate.parked)
    .map((candidate) => {
      const candidateForwardX = Math.sin(candidate.heading);
      const candidateForwardZ = Math.cos(candidate.heading);
      const deltaX = intersection.node.position[0] - candidate.position[0];
      const deltaZ = intersection.node.position[1] - candidate.position[1];
      return {
        candidate,
        distance: Math.hypot(deltaX, deltaZ),
        forward: deltaX * candidateForwardX + deltaZ * candidateForwardZ,
        headingDot: candidateForwardX * forwardX + candidateForwardZ * forwardZ,
      };
    })
    .filter(({ distance, forward }) => distance <= 7 && forward >= -2.5)
    .filter(({ candidate, headingDot }) => candidate.id === vehicle.id || headingDot < 0.82)
    .sort((left, right) => {
      const leftClearing = left.forward < -0.05 ? 1 : 0;
      const rightClearing = right.forward < -0.05 ? 1 : 0;
      if (leftClearing !== rightClearing) return rightClearing - leftClearing;
      if (leftClearing && rightClearing && Math.abs(left.forward - right.forward) > 0.1) {
        return left.forward - right.forward;
      }
      const leftInside = left.distance <= 2.5 ? 1 : 0;
      const rightInside = right.distance <= 2.5 ? 1 : 0;
      if (leftInside !== rightInside) return rightInside - leftInside;
      const leftControlled = left.candidate.controlled ? 1 : 0;
      const rightControlled = right.candidate.controlled ? 1 : 0;
      if (leftControlled !== rightControlled) return rightControlled - leftControlled;
      const leftEta = left.distance / Math.max(0.8, Math.abs(left.candidate.speed));
      const rightEta = right.distance / Math.max(0.8, Math.abs(right.candidate.speed));
      if (Math.abs(leftEta - rightEta) > 0.8) return leftEta - rightEta;
      return left.candidate.id.localeCompare(right.candidate.id);
    });
  const winner = candidates[0]?.candidate;
  const hasPriority = !winner || winner.id === vehicle.id;
  if (hasPriority) {
    return { intersectionId: intersection.node.id, hasPriority: true, speedScale: 1 };
  }
  const speedScale = Math.max(0, Math.min(1, (intersection.distance - 4.1) / 2.9));
  return { intersectionId: intersection.node.id, hasPriority: false, speedScale };
}

export function getVehicleClearanceScale(
  vehiclePosition: TownVec2,
  heading: number,
  otherVehicles: readonly TownVec2[],
): number {
  const stopDistance = 2.9;
  const fullSpeedDistance = 5.4;
  const forwardX = Math.sin(heading);
  const forwardZ = Math.cos(heading);
  let scale = 1;
  for (const other of otherVehicles) {
    const deltaX = other[0] - vehiclePosition[0];
    const deltaZ = other[1] - vehiclePosition[1];
    const distance = Math.hypot(deltaX, deltaZ);
    const forwardDistance = deltaX * forwardX + deltaZ * forwardZ;
    const lateralDistance = Math.abs(deltaX * forwardZ - deltaZ * forwardX);
    if (forwardDistance < -0.5 || lateralDistance > 2.2 || distance >= fullSpeedDistance) continue;
    if (distance <= stopDistance) return 0;
    scale = Math.min(scale, (distance - stopDistance) / (fullSpeedDistance - stopDistance));
  }
  return Math.max(0, Math.min(1, scale));
}

export function getParkingApproachSpeed(distance: number): number {
  if (distance <= 0) return 0;
  return Math.min(4.2, Math.sqrt(4.8 * distance));
}
