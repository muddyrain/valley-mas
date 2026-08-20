/// <reference lib="webworker" />

import {
  createSimulationKernel,
  type PlaybackRate,
  type SimulationKernel,
} from '@/simulation/kernel/kernel';
import { createKernelDiagnosticFrame } from '@/simulation/observation/kernelDiagnostics';
import {
  encodeKernelSnapshot,
  restoreSimulationKernel,
} from '@/simulation/persistence/kernelSnapshot';
import { ElevationBand, elevationBandAt, SurfaceHabitat } from '@/simulation/world/worldFacts';
import {
  projectEmptyTerritory,
  projectKernelInspection,
  projectKernelMap,
  projectKernelResourceDelta,
  projectKernelResources,
  projectKernelSnapshot,
} from './kernelCompatibilityProjection';
import {
  type ObservationEventEnvelope,
  WORKER_PROTOCOL_VERSION,
  type WorkerCommandEnvelope,
  type WorkerObservationEvent,
  type WorkerReliableEvent,
} from './protocol';
import { createWorkerCommandGate } from './workerCommandGate';

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
let kernel: SimulationKernel | null = null;
let speed: PlaybackRate = 1;
let worldId = '';
let nextCommandSequence = 0;
let lastSnapshotAt = 0;
let totalTickMs = 0;
let measuredTicks = 0;
let lastTickMs = 0;
let nextTickAt = performance.now();
let reliableSequence = 0;
let observationSequence = 0;
let generationSequence = 0;
let generation = 'generation-0';
const commandGate = createWorkerCommandGate();

function emitReliable(event: WorkerReliableEvent): void {
  reliableSequence += 1;
  workerScope.postMessage({
    protocolVersion: WORKER_PROTOCOL_VERSION,
    channel: 'reliable',
    sequence: reliableSequence,
    event,
  });
}

function emitObservation(event: WorkerObservationEvent, transfers: Transferable[] = []): void {
  const previousSequence = observationSequence;
  observationSequence += 1;
  const envelope: ObservationEventEnvelope = {
    protocolVersion: WORKER_PROTOCOL_VERSION,
    channel: 'observation',
    sequence: observationSequence,
    previousSequence,
    generation,
    event,
  };
  workerScope.postMessage(envelope, transfers);
}

function mapTransfers(map: ReturnType<typeof projectKernelMap>): Transferable[] {
  return [
    map.terrain.buffer,
    map.height.buffer,
    map.moisture.buffer,
    map.temperature.buffer,
    map.resourceFood.buffer,
    map.fire.buffer,
    map.rain.buffer,
    map.plague.buffer,
    map.crops.buffer,
    map.craters.buffer,
    map.roads.buffer,
  ];
}

function resourceTransfers(resources: ReturnType<typeof projectKernelResources>): Transferable[] {
  return [
    resources.nodeIds.buffer,
    resources.active.buffer,
    resources.kind.buffer,
    resources.positionsX.buffer,
    resources.positionsZ.buffer,
    resources.amount.buffer,
    resources.stage.buffer,
    resources.variant.buffer,
  ];
}

function territoryTransfers(territory: ReturnType<typeof projectEmptyTerritory>): Transferable[] {
  return [
    territory.cells.buffer,
    territory.villageIds.buffer,
    territory.claimStrength.buffer,
    territory.planningZoneKinds.buffer,
  ];
}

function snapshotTransfers(snapshot: ReturnType<typeof projectKernelSnapshot>): Transferable[] {
  return [
    snapshot.positionsX.buffer,
    snapshot.active.buffer,
    snapshot.positionsZ.buffer,
    snapshot.headings.buffer,
    snapshot.states.buffer,
    snapshot.kinds.buffer,
    snapshot.villageIds.buffer,
    snapshot.kingdomIds.buffer,
    snapshot.health.buffer,
    snapshot.infected.buffer,
    snapshot.professions.buffer,
    snapshot.levels.buffer,
    snapshot.roles.buffer,
    snapshot.weaponTiers.buffer,
    snapshot.armorTiers.buffer,
    snapshot.ages.buffer,
    snapshot.targetCells.buffer,
    snapshot.carriedResourceKinds.buffer,
    snapshot.carriedResources.buffer,
  ];
}

function projectDynamicSnapshot() {
  if (!kernel) throw new Error('World is not initialized');
  return projectKernelSnapshot(kernel, {
    tickMs: lastTickMs,
    averageTickMs: measuredTicks > 0 ? totalTickMs / measuredTicks : 0,
  });
}

function emitDynamicFrame(): void {
  if (!kernel) return;
  const snapshot = projectDynamicSnapshot();
  emitObservation(
    {
      type: 'dynamic-frame',
      tick: kernel.state.tick,
      checksum: kernel.checksum(),
      snapshot,
      diagnostic: createKernelDiagnosticFrame(kernel),
    },
    snapshotTransfers(snapshot),
  );
}

function emitSummary(): void {
  if (!kernel) return;
  emitObservation({
    type: 'ui-summary',
    tick: kernel.state.tick,
    checksum: kernel.checksum(),
    paused: kernel.state.paused,
    humans: kernel.state.civilization.humans,
  });
}

function emitKeyframe(): void {
  if (!kernel) return;
  generationSequence += 1;
  generation = `generation-${generationSequence}`;
  observationSequence = 0;
  const map = projectKernelMap(kernel);
  const resources = projectKernelResources(kernel);
  const territory = projectEmptyTerritory();
  const snapshot = projectDynamicSnapshot();
  emitObservation(
    {
      type: 'keyframe',
      tick: kernel.state.tick,
      checksum: kernel.checksum(),
      projection: {
        seed: kernel.state.seed,
        map,
        resources,
        territory,
        snapshot,
        diagnostic: createKernelDiagnosticFrame(kernel),
      },
    },
    [
      ...mapTransfers(map),
      ...resourceTransfers(resources),
      ...territoryTransfers(territory),
      ...snapshotTransfers(snapshot),
    ],
  );
}

function resetRuntimeClock(): void {
  nextCommandSequence = kernel?.state.commands.lastSequence ?? 0;
  totalTickMs = 0;
  measuredTicks = 0;
  lastTickMs = 0;
  nextTickAt = performance.now();
}

function initialize(
  command: Extract<WorkerCommandEnvelope['command'], { type: 'initialize-world' }>,
): void {
  worldId = command.worldId;
  kernel = createSimulationKernel({
    seed: command.seed,
    size: command.size,
    preset: command.preset,
    naturalContent: command.naturalContent,
  });
  kernel.setPlaybackRate(speed);
  resetRuntimeClock();
  emitKeyframe();
}

function cellsInRadius(centerCell: number, radius: number): number[] {
  if (!kernel) return [];
  const size = kernel.state.world.size;
  const centerX = centerCell % size;
  const centerZ = Math.floor(centerCell / size);
  const result: number[] = [];
  const integerRadius = Math.max(0, Math.floor(radius));
  for (let z = centerZ - integerRadius; z <= centerZ + integerRadius; z += 1) {
    for (let x = centerX - integerRadius; x <= centerX + integerRadius; x += 1) {
      if (x < 0 || z < 0 || x >= size || z >= size) continue;
      if (Math.hypot(x - centerX, z - centerZ) > integerRadius + 0.2) continue;
      result.push(z * size + x);
    }
  }
  return result;
}

function sequence(): number {
  nextCommandSequence += 1;
  return nextCommandSequence;
}

function projectMapDelta(cells: number[]) {
  if (!kernel) throw new Error('World is not initialized');
  const map = projectKernelMap(kernel);
  return {
    cells: Uint32Array.from(cells),
    terrain: Uint8Array.from(cells, (cell) => map.terrain[cell] ?? 0),
    height: Float32Array.from(cells, (cell) => map.height[cell] ?? 0),
    moisture: Uint8Array.from(cells, (cell) => map.moisture[cell] ?? 0),
    temperature: Uint8Array.from(cells, (cell) => map.temperature[cell] ?? 0),
    resourceFood: Uint16Array.from(cells, (cell) => map.resourceFood[cell] ?? 0),
    fire: Uint8Array.from(cells, (cell) => map.fire[cell] ?? 0),
    rain: Uint8Array.from(cells, (cell) => map.rain[cell] ?? 0),
    plague: Uint8Array.from(cells, (cell) => map.plague[cell] ?? 0),
    crops: Uint8Array.from(cells, (cell) => map.crops[cell] ?? 0),
    craters: Uint8Array.from(cells, (cell) => map.craters[cell] ?? 0),
    roads: Uint8Array.from(cells, (cell) => map.roads[cell] ?? 0),
  };
}

function editMap(
  command: Extract<WorkerCommandEnvelope['command'], { type: 'edit-terrain' }>,
): void {
  if (!kernel) return;
  for (const cell of cellsInRadius(command.cell, command.radius)) {
    const currentElevation = kernel.state.world.elevation[cell] ?? 0;
    if (command.tool === 'raise') {
      kernel.enqueue({ type: 'raise-terrain', sequence: sequence(), cell, amount: 0.7 });
    } else if (command.tool === 'lower') {
      kernel.enqueue({ type: 'lower-terrain', sequence: sequence(), cell, amount: 0.7 });
    } else if (command.tool === 'paint-land') {
      const currentBand = elevationBandAt(currentElevation);
      if (currentBand === ElevationBand.Mountain) {
        kernel.enqueue({
          type: 'lower-terrain',
          sequence: sequence(),
          cell,
          amount: Math.max(0, currentElevation - 1),
        });
      } else if (currentBand !== ElevationBand.Land) {
        kernel.enqueue({
          type: 'raise-terrain',
          sequence: sequence(),
          cell,
          amount: Math.max(0, 0.8 - currentElevation),
        });
      }
      kernel.enqueue({
        type: 'set-surface',
        sequence: sequence(),
        cell,
        surface: SurfaceHabitat.Grassland,
      });
    } else if (command.tool === 'paint-water') {
      kernel.enqueue({
        type: 'lower-terrain',
        sequence: sequence(),
        cell,
        amount: Math.max(0, currentElevation + 1.2),
      });
    } else {
      kernel.enqueue({
        type: 'set-surface',
        sequence: sequence(),
        cell,
        surface: SurfaceHabitat.WoodlandSoil,
      });
    }
  }
  kernel.flushCommands();
  const dirtyCells = [...new Set(kernel.state.world.dirtyCells)];
  const dirtyResourceIds = [...new Set(kernel.state.resources.dirtyResourceIds)];
  const delta = projectMapDelta(dirtyCells);
  kernel.state.world.dirtyCells = [];
  kernel.state.resources.dirtyResourceIds = [];
  emitObservation(
    {
      type: 'map-delta',
      tick: kernel.state.tick,
      checksum: kernel.checksum(),
      delta,
    },
    [
      delta.cells.buffer,
      delta.terrain.buffer,
      delta.height.buffer,
      delta.moisture.buffer,
      delta.temperature.buffer,
      delta.resourceFood.buffer,
      delta.fire.buffer,
      delta.rain.buffer,
      delta.plague.buffer,
      delta.crops.buffer,
      delta.craters.buffer,
      delta.roads.buffer,
    ],
  );
  if (dirtyResourceIds.length > 0) {
    const resources = projectKernelResourceDelta(kernel, dirtyResourceIds);
    emitObservation(
      {
        type: 'resource-delta',
        tick: kernel.state.tick,
        checksum: kernel.checksum(),
        resources,
      },
      resourceTransfers(resources),
    );
  }
  emitSummary();
}

function placeHumans(
  command: Extract<WorkerCommandEnvelope['command'], { type: 'place-humans' }>,
): void {
  const current = requireKernel();
  current.enqueue({
    type: 'place-humans',
    sequence: sequence(),
    cell: command.cell,
    count: command.count,
  });
  const result = current.flushCommands()[0];
  if (!result || result.status !== 'accepted') {
    throw new Error(result?.reason ?? 'Human placement failed');
  }
  emitDynamicFrame();
  emitSummary();
}

function requireKernel(): SimulationKernel {
  if (!kernel) throw new Error('World is not initialized');
  return kernel;
}

function handleCommand(envelope: WorkerCommandEnvelope): void {
  const command = envelope.command;
  if (command.type === 'initialize-world') {
    initialize(command);
    return;
  }
  if (command.type === 'set-paused') {
    const current = requireKernel();
    current.setPaused(command.paused);
    nextCommandSequence = current.state.commands.lastSequence;
    nextTickAt = performance.now();
    emitSummary();
    return;
  }
  if (command.type === 'set-playback-rate') {
    speed = command.rate;
    kernel?.setPlaybackRate(speed);
    nextTickAt = performance.now();
    emitSummary();
    return;
  }
  if (command.type === 'edit-terrain') {
    editMap(command);
    return;
  }
  if (command.type === 'place-humans') {
    placeHumans(command);
    return;
  }
  if (command.type === 'inspect') {
    emitReliable({
      type: 'inspection-result',
      inspection: projectKernelInspection(requireKernel(), command.target, command.id),
    });
    return;
  }
  if (command.type === 'request-keyframe') {
    requireKernel();
    emitKeyframe();
    return;
  }
  if (command.type === 'create-snapshot') {
    const current = requireKernel();
    current.flushCommands();
    const encoded = encodeKernelSnapshot(current, worldId);
    emitReliable({
      type: 'snapshot-result',
      requestId: command.requestId,
      status: 'created',
      encoded,
      worldId,
      checksum: current.checksum(),
    });
    return;
  }
  const restored = restoreSimulationKernel(command.encoded);
  kernel = restored.kernel;
  worldId = restored.worldId;
  kernel.setPlaybackRate(speed);
  resetRuntimeClock();
  emitReliable({
    type: 'snapshot-result',
    requestId: command.requestId,
    status: 'restored',
    worldId,
    checksum: kernel.checksum(),
  });
  emitKeyframe();
}

workerScope.addEventListener('message', (event: MessageEvent<WorkerCommandEnvelope>) => {
  const envelope = event.data;
  if (!envelope || envelope.channel !== 'command') {
    emitReliable({ level: 'error', message: 'Unsupported worker message', type: 'notice' });
    return;
  }
  const gate = commandGate.accept(envelope);
  if (gate.status === 'rejected') {
    emitReliable({
      type: 'command-result',
      commandId: envelope.commandId,
      commandSequence: envelope.sequence,
      status: 'rejected',
      appliedTick: kernel?.state.tick ?? 0,
      code: gate.code,
      expectedSequence: gate.expectedSequence,
    });
    return;
  }
  try {
    handleCommand(envelope);
    emitReliable({
      type: 'command-result',
      commandId: envelope.commandId,
      commandSequence: envelope.sequence,
      status: 'accepted',
      appliedTick: kernel?.state.tick ?? 0,
    });
  } catch (error) {
    if (
      envelope.command.type === 'create-snapshot' ||
      envelope.command.type === 'restore-snapshot'
    ) {
      emitReliable({
        type: 'snapshot-result',
        requestId: envelope.command.requestId,
        status: 'rejected',
        code: envelope.command.type === 'restore-snapshot' ? 'invalid-snapshot' : 'snapshot-failed',
      });
    }
    emitReliable({
      type: 'command-result',
      commandId: envelope.commandId,
      commandSequence: envelope.sequence,
      status: 'rejected',
      appliedTick: kernel?.state.tick ?? 0,
      code: 'command-failed',
    });
    emitReliable({
      type: 'notice',
      level: 'error',
      message: error instanceof Error ? error.message : 'Kernel command failed',
    });
  }
});

function runSimulationTick(): void {
  const now = performance.now();
  if (kernel && !kernel.state.paused) {
    const startedAt = performance.now();
    kernel.step();
    lastTickMs = performance.now() - startedAt;
    totalTickMs += lastTickMs;
    measuredTicks += 1;
  } else {
    nextTickAt = now;
  }
  if (kernel && now - lastSnapshotAt >= 80) {
    lastSnapshotAt = now;
    emitDynamicFrame();
    emitSummary();
  }
  const interval = 50 / speed;
  nextTickAt = Math.max(nextTickAt + interval, now - interval);
  setTimeout(runSimulationTick, Math.max(0, nextTickAt - performance.now()));
}

runSimulationTick();
