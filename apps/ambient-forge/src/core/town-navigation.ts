export type TownVec2 = readonly [number, number];

export interface NavigationNode {
  id: string;
  position: TownVec2;
  neighbors: readonly string[];
  tags?: readonly string[];
}

export interface NavigationGraph {
  nodes: readonly NavigationNode[];
}

export interface TownCollider {
  id: string;
  center: TownVec2;
  halfSize: TownVec2;
  height: number;
  vaultable: boolean;
}

export interface VaultObstacle {
  height: number;
  thickness: number;
  landingBlocked: boolean;
}

export type NavigationCoverage = 'local' | 'districts';

export interface DistrictRouteAssignment {
  index: number;
  total: number;
}

export function createDistrictRouteAssignment(
  residentIndex: number,
  residentTotal: number,
): DistrictRouteAssignment {
  const total = Math.max(1, Math.floor(residentTotal));
  const index = ((Math.floor(residentIndex) % total) + total) % total;
  return { index, total };
}

const distance = (from: TownVec2, to: TownVec2): number =>
  Math.hypot(to[0] - from[0], to[1] - from[1]);

export function findNearestNavigationNode(
  graph: Readonly<NavigationGraph>,
  position: TownVec2,
): NavigationNode | null {
  let closest: NavigationNode | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes) {
    const candidateDistance = distance(node.position, position);
    if (candidateDistance < closestDistance) {
      closest = node;
      closestDistance = candidateDistance;
    }
  }
  return closest;
}

export function findNavigationRoute(
  graph: Readonly<NavigationGraph>,
  startId: string,
  targetId: string,
): string[] {
  if (startId === targetId) return graph.nodes.some((node) => node.id === startId) ? [startId] : [];
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const start = nodes.get(startId);
  const target = nodes.get(targetId);
  if (!start || !target) return [];

  const open = new Set([startId]);
  const previous = new Map<string, string>();
  const travel = new Map<string, number>([[startId, 0]]);
  const score = new Map<string, number>([[startId, distance(start.position, target.position)]]);

  while (open.size > 0) {
    let currentId = '';
    let currentScore = Number.POSITIVE_INFINITY;
    for (const candidateId of open) {
      const candidateScore = score.get(candidateId) ?? Number.POSITIVE_INFINITY;
      if (candidateScore < currentScore) {
        currentId = candidateId;
        currentScore = candidateScore;
      }
    }
    if (!currentId) break;
    if (currentId === targetId) {
      const route = [targetId];
      while (previous.has(route[0])) route.unshift(previous.get(route[0]) as string);
      return route;
    }

    open.delete(currentId);
    const current = nodes.get(currentId);
    if (!current) continue;
    for (const neighborId of current.neighbors) {
      const neighbor = nodes.get(neighborId);
      if (!neighbor) continue;
      const candidateTravel =
        (travel.get(currentId) ?? Number.POSITIVE_INFINITY) +
        distance(current.position, neighbor.position);
      if (candidateTravel >= (travel.get(neighborId) ?? Number.POSITIVE_INFINITY)) continue;
      previous.set(neighborId, currentId);
      travel.set(neighborId, candidateTravel);
      score.set(neighborId, candidateTravel + distance(neighbor.position, target.position));
      open.add(neighborId);
    }
  }
  return [];
}

export function buildNavigationLoop(
  graph: Readonly<NavigationGraph>,
  stopIds: readonly string[],
): NavigationNode[] {
  if (stopIds.length < 2) {
    const node = graph.nodes.find((candidate) => candidate.id === stopIds[0]);
    return node ? [node] : [];
  }
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const route: NavigationNode[] = [];
  for (let index = 0; index < stopIds.length; index += 1) {
    const startId = stopIds[index];
    const targetId = stopIds[(index + 1) % stopIds.length];
    if (!startId || !targetId) continue;
    const segment = findNavigationRoute(graph, startId, targetId);
    for (const id of segment.slice(0, -1)) {
      const node = nodes.get(id);
      if (node && route.at(-1)?.id !== node.id) route.push(node);
    }
  }
  return route;
}

export function planNavigationStops(
  graph: Readonly<NavigationGraph>,
  preferredIds: readonly string[],
  coverage: NavigationCoverage,
  districtAssignment?: Readonly<DistrictRouteAssignment>,
): string[] {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const preferred = preferredIds.filter(
    (id, index) => nodes.has(id) && preferredIds.indexOf(id) === index,
  );
  if (coverage === 'local') return preferred;

  let districtAnchors = graph.nodes
    .filter((node) => node.tags?.includes('district-anchor'))
    .map((node) => node.id);
  if (districtAssignment) {
    const { index, total } = createDistrictRouteAssignment(
      districtAssignment.index,
      districtAssignment.total,
    );
    districtAnchors = districtAnchors
      .filter((id) => !preferred.includes(id))
      .filter((_, anchorIndex) => anchorIndex % total === index);
  }
  const candidates = [...new Set([...preferred, ...districtAnchors])];
  if (candidates.length < 2) return candidates;

  const ordered = [candidates[0] as string];
  const remaining = new Set(candidates.slice(1));
  while (remaining.size > 0) {
    const current = nodes.get(ordered.at(-1) as string);
    if (!current) break;
    let nearestId = '';
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidateId of remaining) {
      const candidate = nodes.get(candidateId);
      if (!candidate) continue;
      const candidateDistance = distance(current.position, candidate.position);
      if (candidateDistance < nearestDistance) {
        nearestId = candidateId;
        nearestDistance = candidateDistance;
      }
    }
    if (!nearestId) break;
    ordered.push(nearestId);
    remaining.delete(nearestId);
  }
  return ordered;
}

function segmentIntersectsExpandedRect(
  from: TownVec2,
  to: TownVec2,
  collider: Readonly<TownCollider>,
  radius: number,
): boolean {
  const inset = 0.0001;
  const minimum: TownVec2 = [
    collider.center[0] - collider.halfSize[0] - radius + inset,
    collider.center[1] - collider.halfSize[1] - radius + inset,
  ];
  const maximum: TownVec2 = [
    collider.center[0] + collider.halfSize[0] + radius - inset,
    collider.center[1] + collider.halfSize[1] + radius - inset,
  ];
  let entry = 0;
  let exit = 1;
  for (const axis of [0, 1] as const) {
    const origin = from[axis];
    const direction = to[axis] - origin;
    if (Math.abs(direction) < 0.000001) {
      if (origin <= minimum[axis] || origin >= maximum[axis]) return false;
      continue;
    }
    const first = (minimum[axis] - origin) / direction;
    const second = (maximum[axis] - origin) / direction;
    entry = Math.max(entry, Math.min(first, second));
    exit = Math.min(exit, Math.max(first, second));
    if (entry >= exit) return false;
  }
  return exit > 0 && entry < 1;
}

export function isNavigationSegmentClear(
  from: TownVec2,
  to: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): boolean {
  const safeRadius = Math.max(0, radius);
  return colliders.every(
    (collider) => !segmentIntersectsExpandedRect(from, to, collider, safeRadius),
  );
}

function findNavigationGridDetour(
  from: TownVec2,
  to: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): TownVec2[] | null {
  const resolution = 0.72;
  const padding = 10;
  const minimumX = Math.min(from[0], to[0]) - padding;
  const maximumX = Math.max(from[0], to[0]) + padding;
  const minimumZ = Math.min(from[1], to[1]) - padding;
  const maximumZ = Math.max(from[1], to[1]) + padding;
  const columns = Math.ceil((maximumX - minimumX) / resolution);
  const rows = Math.ceil((maximumZ - minimumZ) / resolution);
  const points: TownVec2[] = [from, to];
  const gridIndices = new Map<string, number>();
  for (let row = 0; row <= rows; row += 1) {
    for (let column = 0; column <= columns; column += 1) {
      const point: TownVec2 = [minimumX + column * resolution, minimumZ + row * resolution];
      if (isCircleBlockedByRects(point, radius + 0.04, colliders)) continue;
      gridIndices.set(`${column}:${row}`, points.length);
      points.push(point);
    }
  }
  const connections = points.map(() => [] as Array<{ index: number; distance: number }>);
  const connect = (leftIndex: number, rightIndex: number): void => {
    const left = points[leftIndex];
    const right = points[rightIndex];
    if (!left || !right || !isNavigationSegmentClear(left, right, radius, colliders)) return;
    const travelDistance = distance(left, right);
    connections[leftIndex]?.push({ index: rightIndex, distance: travelDistance });
    connections[rightIndex]?.push({ index: leftIndex, distance: travelDistance });
  };
  for (const [key, index] of gridIndices) {
    const [column, row] = key.split(':').map(Number);
    for (const [offsetX, offsetZ] of [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1],
    ] as const) {
      const neighborIndex = gridIndices.get(`${column + offsetX}:${row + offsetZ}`);
      if (neighborIndex !== undefined) connect(index, neighborIndex);
    }
  }
  for (const endpointIndex of [0, 1]) {
    const endpoint = points[endpointIndex];
    if (!endpoint) continue;
    for (let pointIndex = 2; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex];
      if (!point || distance(endpoint, point) > resolution * 2.2) continue;
      connect(endpointIndex, pointIndex);
    }
  }

  const open = new Set<number>([0]);
  const travel = new Map<number, number>([[0, 0]]);
  const score = new Map<number, number>([[0, distance(from, to)]]);
  const previous = new Map<number, number>();
  while (open.size > 0) {
    let currentIndex = -1;
    let currentScore = Number.POSITIVE_INFINITY;
    for (const candidateIndex of open) {
      const candidateScore = score.get(candidateIndex) ?? Number.POSITIVE_INFINITY;
      if (candidateScore >= currentScore) continue;
      currentIndex = candidateIndex;
      currentScore = candidateScore;
    }
    if (currentIndex < 0) break;
    if (currentIndex === 1) break;
    open.delete(currentIndex);
    for (const connection of connections[currentIndex] ?? []) {
      const candidateTravel =
        (travel.get(currentIndex) ?? Number.POSITIVE_INFINITY) + connection.distance;
      if (candidateTravel >= (travel.get(connection.index) ?? Number.POSITIVE_INFINITY)) continue;
      previous.set(connection.index, currentIndex);
      travel.set(connection.index, candidateTravel);
      const point = points[connection.index] ?? to;
      score.set(connection.index, candidateTravel + distance(point, to));
      open.add(connection.index);
    }
  }
  if (!travel.has(1)) return null;
  const indices = [1];
  while (indices[0] !== 0) {
    const parent = previous.get(indices[0] as number);
    if (parent === undefined) return null;
    indices.unshift(parent);
  }
  const path = indices.flatMap((index) => (points[index] ? [points[index]] : []));
  const simplified: TownVec2[] = [path[0] ?? from];
  let anchorIndex = 0;
  while (anchorIndex < path.length - 1) {
    let nextIndex = path.length - 1;
    while (
      nextIndex > anchorIndex + 1 &&
      !isNavigationSegmentClear(path[anchorIndex] ?? from, path[nextIndex] ?? to, radius, colliders)
    ) {
      nextIndex -= 1;
    }
    simplified.push(path[nextIndex] ?? to);
    anchorIndex = nextIndex;
  }
  return simplified.slice(1, -1);
}

function findNavigationDetour(
  from: TownVec2,
  to: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): TownVec2[] | null {
  const padding = 8;
  const minimumX = Math.min(from[0], to[0]) - padding;
  const maximumX = Math.max(from[0], to[0]) + padding;
  const minimumZ = Math.min(from[1], to[1]) - padding;
  const maximumZ = Math.max(from[1], to[1]) + padding;
  const relevantColliders = colliders.filter(
    (collider) =>
      collider.center[0] + collider.halfSize[0] >= minimumX &&
      collider.center[0] - collider.halfSize[0] <= maximumX &&
      collider.center[1] + collider.halfSize[1] >= minimumZ &&
      collider.center[1] - collider.halfSize[1] <= maximumZ,
  );
  const cornerClearance = Math.max(0, radius) + 0.18;
  const points: TownVec2[] = [from, to];
  for (const collider of relevantColliders) {
    const minimumCornerX = collider.center[0] - collider.halfSize[0] - cornerClearance;
    const maximumCornerX = collider.center[0] + collider.halfSize[0] + cornerClearance;
    const minimumCornerZ = collider.center[1] - collider.halfSize[1] - cornerClearance;
    const maximumCornerZ = collider.center[1] + collider.halfSize[1] + cornerClearance;
    for (const point of [
      [minimumCornerX, minimumCornerZ],
      [minimumCornerX, maximumCornerZ],
      [maximumCornerX, minimumCornerZ],
      [maximumCornerX, maximumCornerZ],
    ] as const) {
      const blocked = colliders.some(
        (candidate) =>
          Math.abs(point[0] - candidate.center[0]) <
            candidate.halfSize[0] + Math.max(0, radius) + 0.04 &&
          Math.abs(point[1] - candidate.center[1]) <
            candidate.halfSize[1] + Math.max(0, radius) + 0.04,
      );
      if (!blocked) points.push(point);
    }
  }

  const connections = points.map(() => [] as Array<{ index: number; distance: number }>);
  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const left = points[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      const right = points[rightIndex];
      if (!right || !isNavigationSegmentClear(left, right, radius, colliders)) continue;
      const travelDistance = distance(left, right);
      connections[leftIndex]?.push({ index: rightIndex, distance: travelDistance });
      connections[rightIndex]?.push({ index: leftIndex, distance: travelDistance });
    }
  }

  const remaining = new Set(points.map((_, index) => index));
  const travel = new Map<number, number>([[0, 0]]);
  const previous = new Map<number, number>();
  while (remaining.size > 0) {
    let currentIndex = -1;
    let currentTravel = Number.POSITIVE_INFINITY;
    for (const candidateIndex of remaining) {
      const candidateTravel = travel.get(candidateIndex) ?? Number.POSITIVE_INFINITY;
      if (candidateTravel >= currentTravel) continue;
      currentIndex = candidateIndex;
      currentTravel = candidateTravel;
    }
    if (currentIndex < 0) break;
    remaining.delete(currentIndex);
    if (currentIndex === 1) break;
    for (const connection of connections[currentIndex] ?? []) {
      if (!remaining.has(connection.index)) continue;
      const candidateTravel = currentTravel + connection.distance;
      if (candidateTravel >= (travel.get(connection.index) ?? Number.POSITIVE_INFINITY)) continue;
      travel.set(connection.index, candidateTravel);
      previous.set(connection.index, currentIndex);
    }
  }
  if (!travel.has(1)) return findNavigationGridDetour(from, to, radius, colliders);
  const path = [1];
  while (path[0] !== 0) {
    const parent = previous.get(path[0] as number);
    if (parent === undefined) return findNavigationGridDetour(from, to, radius, colliders);
    path.unshift(parent);
  }
  return path.slice(1, -1).flatMap((index) => (points[index] ? [points[index]] : []));
}

export function createCollisionFreeNavigationGraph(
  graph: Readonly<NavigationGraph>,
  colliders: readonly TownCollider[],
  radius = 0.42,
): NavigationGraph {
  const safeNodes = graph.nodes.map((node) => ({
    ...node,
    position: resolveCircleAgainstRects(node.position, radius + 0.08, colliders),
  }));
  const sourceNodes = new Map(safeNodes.map((node) => [node.id, node]));
  const neighbors = new Map(safeNodes.map((node) => [node.id, new Set<string>()]));
  const detourNodes: NavigationNode[] = [];
  const visited = new Set<string>();
  let detourIndex = 0;
  for (const node of safeNodes) {
    for (const neighborId of node.neighbors) {
      const neighbor = sourceNodes.get(neighborId);
      if (!neighbor) continue;
      const edgeId = [node.id, neighborId].sort().join('↔');
      if (visited.has(edgeId)) continue;
      visited.add(edgeId);
      const detour = isNavigationSegmentClear(node.position, neighbor.position, radius, colliders)
        ? []
        : findNavigationDetour(node.position, neighbor.position, radius, colliders);
      if (detour === null) continue;
      const chain = [
        node.id,
        ...detour.map((position, index) => {
          const id = `pedestrian-detour-${detourIndex}-${index}`;
          detourNodes.push({ id, position, neighbors: [] });
          neighbors.set(id, new Set());
          return id;
        }),
        neighbor.id,
      ];
      detourIndex += 1;
      for (let index = 1; index < chain.length; index += 1) {
        const leftId = chain[index - 1];
        const rightId = chain[index];
        if (!leftId || !rightId) continue;
        neighbors.get(leftId)?.add(rightId);
        neighbors.get(rightId)?.add(leftId);
      }
    }
  }
  return {
    nodes: [...safeNodes, ...detourNodes].map((node) => ({
      ...node,
      neighbors: [...(neighbors.get(node.id) ?? [])],
    })),
  };
}

export function resolveCircleAgainstRects(
  position: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): [number, number] {
  const resolved: [number, number] = [position[0], position[1]];
  const safeRadius = Math.max(0, radius);
  for (let pass = 0; pass < 3; pass += 1) {
    let moved = false;
    for (const collider of colliders) {
      const minX = collider.center[0] - collider.halfSize[0] - safeRadius;
      const maxX = collider.center[0] + collider.halfSize[0] + safeRadius;
      const minZ = collider.center[1] - collider.halfSize[1] - safeRadius;
      const maxZ = collider.center[1] + collider.halfSize[1] + safeRadius;
      if (
        resolved[0] <= minX ||
        resolved[0] >= maxX ||
        resolved[1] <= minZ ||
        resolved[1] >= maxZ
      ) {
        continue;
      }
      const pushes = [
        { axis: 0 as const, value: minX, distance: resolved[0] - minX },
        { axis: 0 as const, value: maxX, distance: maxX - resolved[0] },
        { axis: 1 as const, value: minZ, distance: resolved[1] - minZ },
        { axis: 1 as const, value: maxZ, distance: maxZ - resolved[1] },
      ];
      pushes.sort((left, right) => left.distance - right.distance);
      const push = pushes[0];
      if (push) resolved[push.axis] = push.value;
      moved = true;
    }
    if (!moved) break;
  }
  return resolved;
}

function isCircleBlockedByRects(
  position: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): boolean {
  const safeRadius = Math.max(0, radius);
  return colliders.some((collider) => {
    const minX = collider.center[0] - collider.halfSize[0] - safeRadius;
    const maxX = collider.center[0] + collider.halfSize[0] + safeRadius;
    const minZ = collider.center[1] - collider.halfSize[1] - safeRadius;
    const maxZ = collider.center[1] + collider.halfSize[1] + safeRadius;
    return position[0] > minX && position[0] < maxX && position[1] > minZ && position[1] < maxZ;
  });
}

export function resolveCircleSlideMovement(
  from: TownVec2,
  proposed: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): [number, number] {
  if (colliders.length === 0 || !isCircleBlockedByRects(proposed, radius, colliders)) {
    return [proposed[0], proposed[1]];
  }
  if (isCircleBlockedByRects(from, radius, colliders)) {
    return resolveCircleAgainstRects(from, radius, colliders);
  }

  const candidates: Array<[number, number]> = [];
  const xOnly: [number, number] = [proposed[0], from[1]];
  const zOnly: [number, number] = [from[0], proposed[1]];
  if (!isCircleBlockedByRects(xOnly, radius, colliders)) candidates.push(xOnly);
  if (!isCircleBlockedByRects(zOnly, radius, colliders)) candidates.push(zOnly);
  if (candidates.length === 0) return [from[0], from[1]];
  return candidates.reduce((best, candidate) => {
    const bestDistance = Math.hypot(best[0] - from[0], best[1] - from[1]);
    const candidateDistance = Math.hypot(candidate[0] - from[0], candidate[1] - from[1]);
    return candidateDistance > bestDistance ? candidate : best;
  });
}

const movementScore = (from: TownVec2, candidate: TownVec2, forward: TownVec2): number => {
  const deltaX = candidate[0] - from[0];
  const deltaZ = candidate[1] - from[1];
  const forwardProgress = deltaX * forward[0] + deltaZ * forward[1];
  return forwardProgress * 2 + Math.hypot(deltaX, deltaZ) * 0.35;
};

export function resolveCircleMovement(
  from: TownVec2,
  proposed: TownVec2,
  radius: number,
  colliders: readonly TownCollider[],
): [number, number] {
  const movementX = proposed[0] - from[0];
  const movementZ = proposed[1] - from[1];
  const movementLength = Math.hypot(movementX, movementZ);
  if (movementLength <= 0.0001 || colliders.length === 0) {
    return [proposed[0], proposed[1]];
  }

  const forward: TownVec2 = [movementX / movementLength, movementZ / movementLength];
  const maxResolvedTravel = movementLength * 1.5;
  const fromBlocked = isCircleBlockedByRects(from, radius, colliders);
  const boundResolvedTravel = (candidate: TownVec2): [number, number] | null => {
    const deltaX = candidate[0] - from[0];
    const deltaZ = candidate[1] - from[1];
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= maxResolvedTravel) return [candidate[0], candidate[1]];
    if (!fromBlocked || distance <= 0.0001) return null;
    const scale = maxResolvedTravel / distance;
    return [from[0] + deltaX * scale, from[1] + deltaZ * scale];
  };
  const direct = resolveCircleAgainstRects(proposed, radius, colliders);
  const boundedDirect = boundResolvedTravel(direct);
  const directProgress = boundedDirect
    ? (boundedDirect[0] - from[0]) * forward[0] + (boundedDirect[1] - from[1]) * forward[1]
    : Number.NEGATIVE_INFINITY;
  if (boundedDirect && directProgress >= movementLength * 0.55) return boundedDirect;

  const tangent: TownVec2 = [-forward[1], forward[0]];
  const detourDistance = movementLength;
  const blockingCollider = colliders.find(
    (collider) =>
      Math.abs(proposed[0] - collider.center[0]) < collider.halfSize[0] + radius &&
      Math.abs(proposed[1] - collider.center[1]) < collider.halfSize[1] + radius,
  );
  const side = blockingCollider
    ? (from[0] - blockingCollider.center[0]) * tangent[0] +
      (from[1] - blockingCollider.center[1]) * tangent[1]
    : 0;
  const preferredSign = side < -0.001 ? -1 : 1;
  const detour = (sign: number): [number, number] =>
    resolveCircleSlideMovement(
      from,
      [from[0] + tangent[0] * detourDistance * sign, from[1] + tangent[1] * detourDistance * sign],
      radius,
      colliders,
    );
  const candidates = [
    { position: boundedDirect, preference: 0 },
    { position: detour(preferredSign), preference: detourDistance * 0.8 },
    { position: detour(-preferredSign), preference: 0 },
  ]
    .map((candidate) => ({
      ...candidate,
      position: candidate.position ? boundResolvedTravel(candidate.position) : null,
    }))
    .filter(
      (candidate): candidate is { position: [number, number]; preference: number } =>
        candidate.position !== null,
    );
  if (candidates.length === 0) return [from[0], from[1]];
  return candidates.reduce((best, candidate) =>
    movementScore(from, candidate.position, forward) + candidate.preference >
    movementScore(from, best.position, forward) + best.preference
      ? candidate
      : best,
  ).position;
}

export function canVaultObstacle(obstacle: Readonly<VaultObstacle>): boolean {
  return obstacle.height <= 0.9 && obstacle.thickness <= 0.7 && !obstacle.landingBlocked;
}
