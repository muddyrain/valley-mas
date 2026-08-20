import { z } from 'zod';
import { createSimulationKernelFromState, type SimulationKernel } from '../kernel/kernel';
import type { KernelWorldRoot } from '../kernel/worldRoot';
import type { NaturalResourceStore } from '../resources/naturalResources';
import type { WorldFacts } from '../world/worldFacts';

export const KERNEL_SNAPSHOT_FORMAT = 'eon-vale.kernel-snapshot' as const;
export const KERNEL_SNAPSHOT_VERSION = 1 as const;

const naturalContentSchema = z
  .object({
    vegetation: z.boolean(),
    resources: z.boolean(),
    animals: z.boolean(),
  })
  .strict();

const settleableRegionSchema = z
  .object({
    centerCell: z.number().int().nonnegative(),
    buildableCells: z.number().int().nonnegative(),
    nearbyTrees: z.number().int().nonnegative(),
    nearbyWildFood: z.number().int().nonnegative(),
    nearbyStone: z.number().int().nonnegative(),
    nearbyMetal: z.number().int().nonnegative(),
  })
  .strict();

const worldRepairSchema = z
  .object({
    centerCell: z.number().int().nonnegative(),
    terrainCells: z.array(z.number().int().nonnegative()),
    resourceCells: z.array(z.number().int().nonnegative()),
  })
  .strict();

const worldSchema = z
  .object({
    size: z.union([z.literal(128), z.literal(256), z.literal(384)]),
    preset: z.enum(['archipelago', 'continent', 'ocean']),
    elevation: z.array(z.number().finite()),
    surface: z.array(z.number().int().min(0).max(255)),
    moisture: z.array(z.number().int().min(0).max(255)),
    temperature: z.array(z.number().int().min(0).max(255)),
    naturalContent: naturalContentSchema,
    revision: z.number().int().nonnegative(),
    settleability: z
      .object({
        requiredRegions: z.number().int().nonnegative(),
        regions: z.array(settleableRegionSchema),
        repairs: z.array(worldRepairSchema),
      })
      .strict(),
  })
  .strict();

const resourcesSchema = z
  .object({
    count: z.number().int().nonnegative(),
    active: z.array(z.number().int().min(0).max(1)),
    kind: z.array(z.number().int().min(0).max(255)),
    cell: z.array(z.number().int().nonnegative()),
    amount: z.array(z.number().int().min(0).max(65_535)),
    stage: z.array(z.number().int().min(0).max(255)),
    source: z.array(z.number().int().min(0).max(255)),
    revision: z.number().int().nonnegative(),
  })
  .strict();

const snapshotSchema = z
  .object({
    format: z.literal(KERNEL_SNAPSHOT_FORMAT),
    version: z.literal(KERNEL_SNAPSHOT_VERSION),
    worldId: z.string().min(1),
    seed: z.string().min(1),
    tick: z.number().int().nonnegative(),
    paused: z.boolean(),
    checksum: z.string().regex(/^[0-9a-f]{8}$/),
    world: worldSchema,
    resources: resourcesSchema,
    civilization: z.object({ humans: z.literal(0) }).strict(),
  })
  .strict();

type KernelSnapshot = z.infer<typeof snapshotSchema>;
type KernelSnapshotBody = Omit<KernelSnapshot, 'checksum'>;

export interface DecodedKernelSnapshot {
  worldId: string;
  state: KernelWorldRoot;
}

export interface RestoredSimulationKernel {
  worldId: string;
  kernel: SimulationKernel;
}

function hashText(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function snapshotChecksum(body: KernelSnapshotBody): string {
  return hashText(JSON.stringify(body));
}

function assertLength(label: string, values: readonly unknown[], expected: number): void {
  if (values.length !== expected) {
    throw new Error(`${label} length ${values.length} does not match ${expected}`);
  }
}

function assertCell(label: string, cell: number, cellCount: number): void {
  if (cell >= cellCount) throw new Error(`${label} cell ${cell} is out of range`);
}

function serializeWorld(world: WorldFacts): KernelSnapshot['world'] {
  return {
    size: world.size,
    preset: world.preset,
    elevation: Array.from(world.elevation),
    surface: Array.from(world.surface),
    moisture: Array.from(world.moisture),
    temperature: Array.from(world.temperature),
    naturalContent: { ...world.naturalContent },
    revision: world.revision,
    settleability: {
      requiredRegions: world.settleability.requiredRegions,
      regions: world.settleability.regions.map((region) => ({ ...region })),
      repairs: world.settleability.repairs.map((repair) => ({
        centerCell: repair.centerCell,
        terrainCells: [...repair.terrainCells],
        resourceCells: [...repair.resourceCells],
      })),
    },
  };
}

function serializeResources(resources: NaturalResourceStore): KernelSnapshot['resources'] {
  const count = resources.count;
  return {
    count,
    active: Array.from(resources.active.slice(0, count)),
    kind: Array.from(resources.kind.slice(0, count)),
    cell: Array.from(resources.cell.slice(0, count)),
    amount: Array.from(resources.amount.slice(0, count)),
    stage: Array.from(resources.stage.slice(0, count)),
    source: Array.from(resources.source.slice(0, count)),
    revision: resources.revision,
  };
}

export function encodeKernelSnapshot(kernel: SimulationKernel, worldId: string): string {
  const body: KernelSnapshotBody = {
    format: KERNEL_SNAPSHOT_FORMAT,
    version: KERNEL_SNAPSHOT_VERSION,
    worldId,
    seed: kernel.state.seed,
    tick: kernel.state.tick,
    paused: kernel.state.paused,
    world: serializeWorld(kernel.state.world),
    resources: serializeResources(kernel.state.resources),
    civilization: { humans: 0 },
  };
  return JSON.stringify({ ...body, checksum: snapshotChecksum(body) });
}

function validateShape(snapshot: KernelSnapshot): void {
  const cellCount = snapshot.world.size * snapshot.world.size;
  assertLength('world.elevation', snapshot.world.elevation, cellCount);
  assertLength('world.surface', snapshot.world.surface, cellCount);
  assertLength('world.moisture', snapshot.world.moisture, cellCount);
  assertLength('world.temperature', snapshot.world.temperature, cellCount);

  const resourceArrays = [
    ['resources.active', snapshot.resources.active],
    ['resources.kind', snapshot.resources.kind],
    ['resources.cell', snapshot.resources.cell],
    ['resources.amount', snapshot.resources.amount],
    ['resources.stage', snapshot.resources.stage],
    ['resources.source', snapshot.resources.source],
  ] as const;
  for (const [label, values] of resourceArrays) {
    assertLength(label, values, snapshot.resources.count);
  }
  snapshot.resources.cell.forEach((cell, id) => {
    assertCell(`resource ${id}`, cell, cellCount);
  });
  snapshot.world.settleability.regions.forEach((region, id) => {
    assertCell(`settleable region ${id}`, region.centerCell, cellCount);
  });
}

function restoreResources(snapshot: KernelSnapshot['resources'], cellCount: number) {
  const cellToResource = new Int32Array(cellCount);
  cellToResource.fill(-1);
  for (let id = 0; id < snapshot.count; id += 1) {
    if (snapshot.active[id]) cellToResource[snapshot.cell[id] ?? 0] = id;
  }
  return {
    count: snapshot.count,
    active: Uint8Array.from(snapshot.active),
    kind: Uint8Array.from(snapshot.kind),
    cell: Uint32Array.from(snapshot.cell),
    amount: Uint16Array.from(snapshot.amount),
    stage: Uint8Array.from(snapshot.stage),
    source: Uint8Array.from(snapshot.source),
    cellToResource,
    revision: snapshot.revision,
    dirtyResourceIds: [],
  };
}

export function decodeKernelSnapshot(encoded: string): DecodedKernelSnapshot {
  const snapshot = snapshotSchema.parse(JSON.parse(encoded));
  validateShape(snapshot);
  const { checksum, ...body } = snapshot;
  if (snapshotChecksum(body) !== checksum) throw new Error('Kernel snapshot checksum mismatch');
  const cellCount = snapshot.world.size * snapshot.world.size;
  return {
    worldId: snapshot.worldId,
    state: {
      schemaVersion: 1,
      seed: snapshot.seed,
      tick: snapshot.tick,
      paused: snapshot.paused,
      world: {
        size: snapshot.world.size,
        preset: snapshot.world.preset,
        elevation: Float32Array.from(snapshot.world.elevation),
        surface: Uint8Array.from(snapshot.world.surface),
        moisture: Uint8Array.from(snapshot.world.moisture),
        temperature: Uint8Array.from(snapshot.world.temperature),
        naturalContent: { ...snapshot.world.naturalContent },
        revision: snapshot.world.revision,
        dirtyCells: [],
        settleability: {
          requiredRegions: snapshot.world.settleability.requiredRegions,
          regions: snapshot.world.settleability.regions.map((region) => ({ ...region })),
          repairs: snapshot.world.settleability.repairs.map((repair) => ({
            centerCell: repair.centerCell,
            terrainCells: [...repair.terrainCells],
            resourceCells: [...repair.resourceCells],
          })),
        },
      },
      resources: restoreResources(snapshot.resources, cellCount),
      civilization: { humans: 0, settlementInventories: [] },
      commands: { pending: [], records: [], lastSequence: 0 },
      diagnostics: { invariantErrors: [], lastPhaseTrace: [] },
    },
  };
}

export function restoreSimulationKernel(encoded: string): RestoredSimulationKernel {
  const decoded = decodeKernelSnapshot(encoded);
  return {
    worldId: decoded.worldId,
    kernel: createSimulationKernelFromState(decoded.state),
  };
}
