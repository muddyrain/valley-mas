import {
  ResourceNodeKind,
  ResourceNodeStage,
  type ResourceNodeStore,
  type ResourceRegrowthEvent,
  TerrainType,
  type WorldMap,
} from '@/shared/gameTypes';
import { createSeededRandom, stableNoise } from '@/shared/random';

export interface AddResourceNodeOptions {
  kind: ResourceNodeKind;
  x: number;
  z: number;
  amount: number;
  stage?: ResourceNodeStage;
  variant?: number;
}

export interface HarvestResult {
  amount: number;
  depleted: boolean;
}

export interface RemovedResource {
  kind: ResourceNodeKind;
  amount: number;
}

const DEFAULT_INITIAL_CAPACITY = 512;
const TREE_REGROWTH_TICKS = [720, 1_080, 1_440] as const;

function growTypedArray<T extends ArrayBufferView>(source: T, capacity: number): T {
  const Constructor = source.constructor as {
    new (length: number): T;
  };
  const next = new Constructor(capacity);
  if ('set' in next && typeof next.set === 'function') {
    next.set(source as never);
  }
  return next;
}

function ensureCapacity(store: ResourceNodeStore, required: number): void {
  if (required <= store.capacity) return;
  const capacity = Math.max(required, store.capacity * 2);
  store.active = growTypedArray(store.active, capacity);
  store.kind = growTypedArray(store.kind, capacity);
  store.positionsX = growTypedArray(store.positionsX, capacity);
  store.positionsZ = growTypedArray(store.positionsZ, capacity);
  store.amount = growTypedArray(store.amount, capacity);
  store.maxAmount = growTypedArray(store.maxAmount, capacity);
  store.stage = growTypedArray(store.stage, capacity);
  store.variant = growTypedArray(store.variant, capacity);
  store.reservedBy = growTypedArray(store.reservedBy, capacity);
  store.reservedUntil = growTypedArray(store.reservedUntil, capacity);
  store.regrowAtTick = growTypedArray(store.regrowAtTick, capacity);
  const previousNextLength = store.nextInChunk.length;
  store.nextInChunk = growTypedArray(store.nextInChunk, capacity);
  store.nextInChunk.fill(-1, previousNextLength);
  store.capacity = capacity;
}

function chunkIndex(store: ResourceNodeStore, x: number, z: number): number {
  const chunkX = Math.max(0, Math.min(store.chunkColumns - 1, Math.floor(x / store.chunkSize)));
  const chunkZ = Math.max(0, Math.min(store.chunkRows - 1, Math.floor(z / store.chunkSize)));
  return chunkZ * store.chunkColumns + chunkX;
}

function markDirty(store: ResourceNodeStore, nodeId: number): void {
  store.dirtyNodeIds.push(nodeId);
  const chunk = chunkIndex(store, store.positionsX[nodeId] ?? 0, store.positionsZ[nodeId] ?? 0);
  store.chunkRevisions[chunk] = (store.chunkRevisions[chunk] ?? 0) + 1;
}

function scheduleRegrowth(
  store: ResourceNodeStore,
  nodeId: number,
  stage: ResourceNodeStage,
  tick: number,
): void {
  store.regrowAtTick[nodeId] = tick;
  const event: ResourceRegrowthEvent = { tick, nodeId, stage };
  const queue = store.regrowthQueue;
  let cursor = queue.length;
  while (cursor > 0 && (queue[cursor - 1]?.tick ?? 0) > tick) cursor -= 1;
  queue.splice(cursor, 0, event);
}

export function createResourceNodeStore(mapSize: number, chunkSize = 8): ResourceNodeStore {
  const safeChunkSize = Math.max(1, Math.round(chunkSize));
  const chunkColumns = Math.ceil(mapSize / safeChunkSize);
  const chunkRows = Math.ceil(mapSize / safeChunkSize);
  const nextInChunk = new Int32Array(DEFAULT_INITIAL_CAPACITY);
  nextInChunk.fill(-1);
  const chunkHeads = new Int32Array(chunkColumns * chunkRows);
  chunkHeads.fill(-1);
  return {
    mapSize,
    chunkSize: safeChunkSize,
    chunkColumns,
    chunkRows,
    capacity: DEFAULT_INITIAL_CAPACITY,
    count: 0,
    active: new Uint8Array(DEFAULT_INITIAL_CAPACITY),
    kind: new Uint8Array(DEFAULT_INITIAL_CAPACITY),
    positionsX: new Float32Array(DEFAULT_INITIAL_CAPACITY),
    positionsZ: new Float32Array(DEFAULT_INITIAL_CAPACITY),
    amount: new Uint16Array(DEFAULT_INITIAL_CAPACITY),
    maxAmount: new Uint16Array(DEFAULT_INITIAL_CAPACITY),
    stage: new Uint8Array(DEFAULT_INITIAL_CAPACITY),
    variant: new Uint8Array(DEFAULT_INITIAL_CAPACITY),
    reservedBy: new Uint32Array(DEFAULT_INITIAL_CAPACITY),
    reservedUntil: new Uint32Array(DEFAULT_INITIAL_CAPACITY),
    regrowAtTick: new Uint32Array(DEFAULT_INITIAL_CAPACITY),
    chunkHeads,
    nextInChunk,
    chunkRevisions: new Uint32Array(chunkColumns * chunkRows),
    dirtyNodeIds: [],
    regrowthQueue: [],
  };
}

export function addResourceNode(store: ResourceNodeStore, options: AddResourceNodeOptions): number {
  const nodeId = store.count;
  ensureCapacity(store, nodeId + 1);
  const x = Math.max(0, Math.min(store.mapSize - 0.001, options.x));
  const z = Math.max(0, Math.min(store.mapSize - 0.001, options.z));
  const amount = Math.max(0, Math.round(options.amount));
  store.count += 1;
  store.active[nodeId] = 1;
  store.kind[nodeId] = options.kind;
  store.positionsX[nodeId] = x;
  store.positionsZ[nodeId] = z;
  store.amount[nodeId] = amount;
  store.maxAmount[nodeId] = amount;
  store.stage[nodeId] = options.stage ?? ResourceNodeStage.Mature;
  store.variant[nodeId] = options.variant ?? 0;
  const chunk = chunkIndex(store, x, z);
  store.nextInChunk[nodeId] = store.chunkHeads[chunk] ?? -1;
  store.chunkHeads[chunk] = nodeId;
  markDirty(store, nodeId);
  return nodeId;
}

function canGenerateTree(terrain: TerrainType): boolean {
  return terrain === TerrainType.Forest || terrain === TerrainType.Grass;
}

export function generateResourceNodes(map: WorldMap, seed: string): ResourceNodeStore {
  const store = createResourceNodeStore(map.size, 8);
  const random = createSeededRandom(`${seed}:resource-nodes:${map.preset}:${map.size}`);
  for (let cell = 0; cell < map.terrain.length; cell += 1) {
    const terrain = map.terrain[cell] as TerrainType;
    const x = cell % map.size;
    const z = Math.floor(cell / map.size);
    const moisture = map.moisture[cell] ?? 0;
    const height = map.height[cell] ?? 0;
    const noise = stableNoise(cell * 1_103 + 17);
    if (
      canGenerateTree(terrain) &&
      ((terrain === TerrainType.Forest && noise > 0.08) ||
        (terrain === TerrainType.Grass && moisture > 105 && noise > 0.88))
    ) {
      addResourceNode(store, {
        kind: ResourceNodeKind.Tree,
        x: x + 0.18 + random() * 0.64,
        z: z + 0.18 + random() * 0.64,
        amount: 3 + Math.floor(random() * 5),
        variant: Math.floor(random() * 4),
      });
      if (terrain === TerrainType.Forest && stableNoise(cell * 941 + 113) > 0.35) {
        addResourceNode(store, {
          kind: ResourceNodeKind.Tree,
          x: x + 0.12 + random() * 0.76,
          z: z + 0.12 + random() * 0.76,
          amount: 2 + Math.floor(random() * 5),
          variant: Math.floor(random() * 4),
        });
      }
    }
    if (
      (terrain === TerrainType.Mountain && noise > 0.16) ||
      (height > 0.65 && terrain !== TerrainType.DeepOcean && noise > 0.965)
    ) {
      addResourceNode(store, {
        kind: ResourceNodeKind.Stone,
        x: x + 0.15 + random() * 0.7,
        z: z + 0.15 + random() * 0.7,
        amount: 5 + Math.floor(random() * 12),
        variant: Math.floor(random() * 3),
      });
    }
    if (terrain === TerrainType.Mountain && stableNoise(cell * 1_939 + 211) > 0.955) {
      addResourceNode(store, {
        kind: ResourceNodeKind.Metal,
        x: x + 0.2 + random() * 0.6,
        z: z + 0.2 + random() * 0.6,
        amount: 24 + Math.floor(random() * 40),
        variant: Math.floor(random() * 2),
      });
    }
  }
  const minimumNodeCount = Math.floor(map.terrain.length * 0.2);
  const startCell = Math.floor(random() * map.terrain.length);
  for (
    let attempt = 0;
    attempt < map.terrain.length && store.count < minimumNodeCount;
    attempt += 1
  ) {
    const cell = (startCell + attempt * 7_919) % map.terrain.length;
    const terrain = map.terrain[cell] as TerrainType;
    const x = cell % map.size;
    const z = Math.floor(cell / map.size);
    if (
      (terrain === TerrainType.Forest || terrain === TerrainType.Grass) &&
      (map.moisture[cell] ?? 0) >= 75
    ) {
      addResourceNode(store, {
        kind: ResourceNodeKind.Tree,
        x: x + 0.14 + random() * 0.72,
        z: z + 0.14 + random() * 0.72,
        amount: 2 + Math.floor(random() * 5),
        variant: Math.floor(random() * 4),
      });
    } else if (terrain === TerrainType.Mountain) {
      addResourceNode(store, {
        kind: ResourceNodeKind.Stone,
        x: x + 0.18 + random() * 0.64,
        z: z + 0.18 + random() * 0.64,
        amount: 4 + Math.floor(random() * 10),
        variant: Math.floor(random() * 3),
      });
    }
  }
  store.dirtyNodeIds.length = 0;
  store.chunkRevisions.fill(0);
  return store;
}

export function findNearestAvailableResourceNode(
  store: ResourceNodeStore,
  x: number,
  z: number,
  kind: ResourceNodeKind,
  tick: number,
  maxRadius: number,
  acceptNode: (nodeId: number) => boolean = () => true,
): number {
  const minChunkX = Math.max(0, Math.floor((x - maxRadius) / store.chunkSize));
  const maxChunkX = Math.min(store.chunkColumns - 1, Math.floor((x + maxRadius) / store.chunkSize));
  const minChunkZ = Math.max(0, Math.floor((z - maxRadius) / store.chunkSize));
  const maxChunkZ = Math.min(store.chunkRows - 1, Math.floor((z + maxRadius) / store.chunkSize));
  const maximumDistanceSquared = maxRadius * maxRadius;
  let nearest = -1;
  let nearestDistanceSquared = maximumDistanceSquared;
  for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      let nodeId = store.chunkHeads[chunkZ * store.chunkColumns + chunkX] ?? -1;
      while (nodeId >= 0) {
        if (
          store.active[nodeId] === 1 &&
          acceptNode(nodeId) &&
          store.kind[nodeId] === kind &&
          store.stage[nodeId] === ResourceNodeStage.Mature &&
          (store.amount[nodeId] ?? 0) > 0 &&
          ((store.reservedBy[nodeId] ?? 0) === 0 || (store.reservedUntil[nodeId] ?? 0) < tick)
        ) {
          const dx = (store.positionsX[nodeId] ?? 0) - x;
          const dz = (store.positionsZ[nodeId] ?? 0) - z;
          const distanceSquared = dx * dx + dz * dz;
          if (distanceSquared <= nearestDistanceSquared) {
            nearest = nodeId;
            nearestDistanceSquared = distanceSquared;
          }
        }
        nodeId = store.nextInChunk[nodeId] ?? -1;
      }
    }
  }
  return nearest;
}

export function reserveResourceNode(
  store: ResourceNodeStore,
  nodeId: number,
  entityId: number,
  tick: number,
  duration: number,
): boolean {
  if (
    nodeId < 0 ||
    nodeId >= store.count ||
    store.active[nodeId] !== 1 ||
    store.stage[nodeId] !== ResourceNodeStage.Mature ||
    (store.amount[nodeId] ?? 0) === 0
  ) {
    return false;
  }
  const reservedBy = store.reservedBy[nodeId] ?? 0;
  if (reservedBy !== 0 && (store.reservedUntil[nodeId] ?? 0) >= tick) return false;
  store.reservedBy[nodeId] = entityId + 1;
  store.reservedUntil[nodeId] = tick + Math.max(1, duration);
  return true;
}

export function resourceNodeAvoidance(
  store: ResourceNodeStore,
  x: number,
  z: number,
  radius: number,
): { x: number; z: number } {
  const minChunkX = Math.max(0, Math.floor((x - radius) / store.chunkSize));
  const maxChunkX = Math.min(store.chunkColumns - 1, Math.floor((x + radius) / store.chunkSize));
  const minChunkZ = Math.max(0, Math.floor((z - radius) / store.chunkSize));
  const maxChunkZ = Math.min(store.chunkRows - 1, Math.floor((z + radius) / store.chunkSize));
  let resultX = 0;
  let resultZ = 0;
  for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      let nodeId = store.chunkHeads[chunkZ * store.chunkColumns + chunkX] ?? -1;
      while (nodeId >= 0) {
        if (store.active[nodeId] === 1) {
          const dx = x - (store.positionsX[nodeId] ?? 0);
          const dz = z - (store.positionsZ[nodeId] ?? 0);
          const distance = Math.hypot(dx, dz);
          if (distance > 0.001 && distance < radius) {
            const weight = (radius - distance) / radius;
            resultX += (dx / distance) * weight;
            resultZ += (dz / distance) * weight;
          }
        }
        nodeId = store.nextInChunk[nodeId] ?? -1;
      }
    }
  }
  const magnitude = Math.hypot(resultX, resultZ);
  if (magnitude <= 1) return { x: resultX, z: resultZ };
  return { x: resultX / magnitude, z: resultZ / magnitude };
}

export function findResourceNodesInRadius(
  store: ResourceNodeStore,
  x: number,
  z: number,
  radius: number,
): number[] {
  const found: number[] = [];
  const minChunkX = Math.max(0, Math.floor((x - radius) / store.chunkSize));
  const maxChunkX = Math.min(store.chunkColumns - 1, Math.floor((x + radius) / store.chunkSize));
  const minChunkZ = Math.max(0, Math.floor((z - radius) / store.chunkSize));
  const maxChunkZ = Math.min(store.chunkRows - 1, Math.floor((z + radius) / store.chunkSize));
  const radiusSquared = radius * radius;
  for (let chunkZ = minChunkZ; chunkZ <= maxChunkZ; chunkZ += 1) {
    for (let chunkX = minChunkX; chunkX <= maxChunkX; chunkX += 1) {
      let nodeId = store.chunkHeads[chunkZ * store.chunkColumns + chunkX] ?? -1;
      while (nodeId >= 0) {
        const dx = (store.positionsX[nodeId] ?? 0) - x;
        const dz = (store.positionsZ[nodeId] ?? 0) - z;
        if (store.active[nodeId] === 1 && dx * dx + dz * dz <= radiusSquared) found.push(nodeId);
        nodeId = store.nextInChunk[nodeId] ?? -1;
      }
    }
  }
  return found.sort((left, right) => left - right);
}

export function removeResourceNode(store: ResourceNodeStore, nodeId: number): RemovedResource {
  const kind = (store.kind[nodeId] ?? ResourceNodeKind.Tree) as ResourceNodeKind;
  if (nodeId < 0 || nodeId >= store.count || store.active[nodeId] !== 1) {
    return { kind, amount: 0 };
  }
  const amount = store.amount[nodeId] ?? 0;
  store.active[nodeId] = 0;
  store.amount[nodeId] = 0;
  store.stage[nodeId] = ResourceNodeStage.Depleted;
  store.reservedBy[nodeId] = 0;
  store.reservedUntil[nodeId] = 0;
  store.regrowAtTick[nodeId] = 0;
  markDirty(store, nodeId);
  return { kind, amount };
}

export function matureResourceNode(store: ResourceNodeStore, nodeId: number): boolean {
  if (nodeId < 0 || nodeId >= store.count || store.kind[nodeId] !== ResourceNodeKind.Tree) {
    return false;
  }
  store.active[nodeId] = 1;
  store.stage[nodeId] = ResourceNodeStage.Mature;
  store.amount[nodeId] = Math.max(1, store.maxAmount[nodeId] ?? 1);
  store.regrowAtTick[nodeId] = 0;
  markDirty(store, nodeId);
  return true;
}

export function harvestResourceNode(
  store: ResourceNodeStore,
  nodeId: number,
  tick: number,
  requestedAmount = 1,
): HarvestResult {
  const available = store.amount[nodeId] ?? 0;
  if (nodeId < 0 || nodeId >= store.count || store.active[nodeId] !== 1 || available === 0) {
    return { amount: 0, depleted: available === 0 };
  }
  const amount = Math.min(available, Math.max(1, Math.round(requestedAmount)));
  store.amount[nodeId] = available - amount;
  store.reservedBy[nodeId] = 0;
  store.reservedUntil[nodeId] = 0;
  const depleted = store.amount[nodeId] === 0;
  if (depleted) {
    if (store.kind[nodeId] === ResourceNodeKind.Tree) {
      store.stage[nodeId] = ResourceNodeStage.Stump;
      scheduleRegrowth(store, nodeId, ResourceNodeStage.Stump, tick + TREE_REGROWTH_TICKS[0]);
    } else {
      store.stage[nodeId] = ResourceNodeStage.Depleted;
      store.regrowAtTick[nodeId] = 0;
    }
  }
  markDirty(store, nodeId);
  return { amount, depleted };
}

function treeHabitatAllowsRegrowth(
  map: WorldMap,
  nodeId: number,
  store: ResourceNodeStore,
): boolean {
  const x = Math.floor(store.positionsX[nodeId] ?? 0);
  const z = Math.floor(store.positionsZ[nodeId] ?? 0);
  const cell = z * map.size + x;
  const terrain = map.terrain[cell] as TerrainType;
  return (
    (terrain === TerrainType.Forest || terrain === TerrainType.Grass) &&
    (map.moisture[cell] ?? 0) >= 70 &&
    (map.fire[cell] ?? 0) === 0
  );
}

export function advanceResourceRegrowth(
  store: ResourceNodeStore,
  map: WorldMap,
  tick: number,
  budget: number,
): number {
  let processed = 0;
  while (processed < budget && (store.regrowthQueue[0]?.tick ?? Number.POSITIVE_INFINITY) <= tick) {
    const event = store.regrowthQueue.shift();
    if (!event) break;
    const { nodeId } = event;
    if (
      store.active[nodeId] !== 1 ||
      store.kind[nodeId] !== ResourceNodeKind.Tree ||
      store.stage[nodeId] !== event.stage ||
      store.regrowAtTick[nodeId] !== event.tick
    ) {
      continue;
    }
    if (!treeHabitatAllowsRegrowth(map, nodeId, store)) {
      scheduleRegrowth(store, nodeId, event.stage, tick + TREE_REGROWTH_TICKS[0]);
      processed += 1;
      continue;
    }
    if (event.stage === ResourceNodeStage.Stump) {
      store.stage[nodeId] = ResourceNodeStage.Sapling;
      scheduleRegrowth(store, nodeId, ResourceNodeStage.Sapling, tick + TREE_REGROWTH_TICKS[1]);
    } else if (event.stage === ResourceNodeStage.Sapling) {
      store.stage[nodeId] = ResourceNodeStage.Young;
      scheduleRegrowth(store, nodeId, ResourceNodeStage.Young, tick + TREE_REGROWTH_TICKS[2]);
    } else if (event.stage === ResourceNodeStage.Young) {
      store.stage[nodeId] = ResourceNodeStage.Mature;
      store.amount[nodeId] = Math.max(1, store.maxAmount[nodeId] ?? 1);
      store.regrowAtTick[nodeId] = 0;
    }
    markDirty(store, nodeId);
    processed += 1;
  }
  return processed;
}
