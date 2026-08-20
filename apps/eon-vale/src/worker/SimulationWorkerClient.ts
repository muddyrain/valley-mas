import type {
  Inspection,
  ResourceNodeSnapshot,
  TerritorySnapshot,
  WorldMapDelta,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from '@/render/renderTypes';
import type {
  ConstructionPriority,
  GodPower,
  MapTool,
  PlanningZoneKind,
  WorldHistoryArchive,
  WorldHistoryFilter,
  WorldPreset,
} from '@/shared/gameTypes';
import { EntityKind } from '@/shared/gameTypes';
import type { KernelDiagnosticFrame } from '@/simulation/observation/kernelDiagnostics';
import type { WorldLawId } from '@/simulation/rules/worldLawCatalog';
import type { NaturalContentOptions } from '@/simulation/world/worldFacts';
import { createObservationInbox } from './observationInbox';
import {
  createCommandEnvelope,
  type TerrainEditTool,
  type VersionedWorkerEvent,
  type WorkerProtocolCommand,
  type WorkerReliableEvent,
} from './protocol';

export interface WorkerClientListeners {
  onReady?: (mode: 'world', population: number, seed: string) => void;
  onWorldSnapshot?: (snapshot: WorldRenderSnapshot) => void;
  onMap?: (map: WorldMapSnapshot) => void;
  onMapDelta?: (delta: WorldMapDelta) => void;
  onResources?: (resources: ResourceNodeSnapshot) => void;
  onTerritory?: (territory: TerritorySnapshot) => void;
  onInspection?: (inspection: Inspection | null) => void;
  onHistory?: (archive: WorldHistoryArchive) => void;
  onNotice?: (level: 'info' | 'error', message: string) => void;
  onDiagnostic?: (diagnostic: KernelDiagnosticFrame) => void;
}

export interface CreatedSnapshot {
  requestId: string;
  encoded: string;
  worldId: string;
  checksum: string;
}

interface PendingSnapshotRequest {
  resolve(event: Extract<WorkerReliableEvent, { type: 'snapshot-result' }>): void;
  reject(error: Error): void;
}

function identifier(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}-${random}`;
}

function terrainTool(tool: MapTool): TerrainEditTool | null {
  return ['raise', 'lower', 'paint-land', 'paint-water', 'paint-forest'].includes(tool)
    ? (tool as TerrainEditTool)
    : null;
}

export class SimulationWorkerClient {
  private readonly worker = new Worker(new URL('./kernel.worker.ts', import.meta.url), {
    type: 'module',
  });
  private readonly clientId = identifier('client');
  private readonly inbox = createObservationInbox();
  private readonly pendingSnapshots = new Map<string, PendingSnapshotRequest>();
  private commandSequence = 0;
  private drainScheduled = false;

  constructor(private readonly listeners: WorkerClientListeners = {}) {
    this.worker.addEventListener('message', (event: MessageEvent<VersionedWorkerEvent>) => {
      this.inbox.push(event.data);
      this.scheduleDrain();
    });
  }

  initializeWorld(
    seed: string,
    mapSize: 128 | 256 | 384 = 256,
    preset: WorldPreset = 'archipelago',
    naturalContent?: NaturalContentOptions,
    worldId = identifier('world'),
  ): void {
    this.send({ type: 'initialize-world', worldId, seed, size: mapSize, preset, naturalContent });
  }

  setPaused(paused: boolean): void {
    this.send({ type: 'set-paused', paused });
  }

  setSpeed(speed: 1 | 2 | 4 | 8): void {
    this.send({ type: 'set-playback-rate', rate: speed });
  }

  setWorldLaw(law: WorldLawId, enabled: boolean): void {
    void law;
    void enabled;
    this.unavailable();
  }

  editMap(tool: MapTool, cell: number, radius: number): void {
    const supported = terrainTool(tool);
    if (supported) this.send({ type: 'edit-terrain', tool: supported, cell, radius });
    else this.unavailable();
  }

  spawn(kind: EntityKind, cell: number, count = 1): void {
    if (kind !== EntityKind.Human) {
      this.unavailable();
      return;
    }
    this.send({ type: 'place-humans', cell, count: Math.max(1, Math.min(40, Math.floor(count))) });
  }

  useGodPower(power: GodPower, cell: number, radius: number): void {
    void power;
    void cell;
    void radius;
    this.unavailable();
  }

  inspect(target: 'entity' | 'village' | 'building' | 'kingdom', id: number): void {
    this.send({ type: 'inspect', target, id });
  }

  requestHistory(filter: WorldHistoryFilter): void {
    this.listeners.onHistory?.({ revision: 0, filter, entries: [] });
  }

  setFavorite(lifeId: number, favorite: boolean): void {
    void lifeId;
    void favorite;
    this.unavailable();
  }

  setConstructionPriority(villageId: number, priority: ConstructionPriority): void {
    void villageId;
    void priority;
    this.unavailable();
  }

  paintPlanningZone(villageId: number, zone: PlanningZoneKind, cell: number, radius = 2): void {
    void villageId;
    void zone;
    void cell;
    void radius;
    this.unavailable();
  }

  createSnapshot(): Promise<CreatedSnapshot> {
    const requestId = identifier('snapshot');
    return new Promise((resolve, reject) => {
      this.pendingSnapshots.set(requestId, {
        resolve: (event) => {
          if (!event.encoded || !event.worldId || !event.checksum) {
            reject(new Error(event.code ?? 'Snapshot result is incomplete'));
            return;
          }
          resolve({
            requestId,
            encoded: event.encoded,
            worldId: event.worldId,
            checksum: event.checksum,
          });
        },
        reject,
      });
      this.send({ type: 'create-snapshot', requestId });
    });
  }

  restoreSnapshot(encoded: string): Promise<void> {
    const requestId = identifier('restore');
    return new Promise((resolve, reject) => {
      this.pendingSnapshots.set(requestId, {
        resolve: (event) => {
          if (event.status === 'restored') resolve();
          else reject(new Error(event.code ?? 'Snapshot restore failed'));
        },
        reject,
      });
      this.send({ type: 'restore-snapshot', requestId, encoded });
    });
  }

  dispose(): void {
    for (const pending of this.pendingSnapshots.values()) {
      pending.reject(new Error('Worker client disposed'));
    }
    this.pendingSnapshots.clear();
    this.worker.terminate();
  }

  private unavailable(): void {
    this.listeners.onNotice?.('info', '此功能暂不可用');
  }

  private send(command: WorkerProtocolCommand): void {
    this.commandSequence += 1;
    const commandId = identifier('command');
    this.worker.postMessage(
      createCommandEnvelope(this.clientId, this.commandSequence, commandId, command),
    );
  }

  private scheduleDrain(): void {
    if (this.drainScheduled) return;
    this.drainScheduled = true;
    queueMicrotask(() => {
      this.drainScheduled = false;
      this.drainInbox();
    });
  }

  private drainInbox(): void {
    const drained = this.inbox.drain();
    for (const message of drained.reliable) {
      const event = message.event;
      if (event.type === 'snapshot-result') {
        const pending = this.pendingSnapshots.get(event.requestId);
        if (pending) {
          this.pendingSnapshots.delete(event.requestId);
          if (event.status === 'rejected')
            pending.reject(new Error(event.code ?? 'Snapshot failed'));
          else pending.resolve(event);
        }
      } else if (event.type === 'inspection-result') {
        this.listeners.onInspection?.(event.inspection);
      } else if (event.type === 'notice') {
        this.listeners.onNotice?.(event.level, event.message);
      } else if (event.status === 'rejected') {
        if (event.expectedSequence !== undefined) {
          this.commandSequence = Math.max(0, event.expectedSequence - 1);
        }
        this.listeners.onNotice?.('error', '世界指令未能执行');
      }
    }
    for (const message of drained.observations) {
      const event = message.event;
      if (event.type === 'keyframe' && event.projection) {
        this.listeners.onReady?.(
          'world',
          event.projection.snapshot.population,
          event.projection.seed,
        );
        this.listeners.onMap?.(event.projection.map);
        this.listeners.onResources?.(event.projection.resources);
        this.listeners.onTerritory?.(event.projection.territory);
        this.listeners.onWorldSnapshot?.(event.projection.snapshot);
        this.listeners.onDiagnostic?.(event.projection.diagnostic);
      } else if (event.type === 'dynamic-frame') {
        if (event.snapshot) this.listeners.onWorldSnapshot?.(event.snapshot);
        if (event.diagnostic) this.listeners.onDiagnostic?.(event.diagnostic);
      } else if (event.type === 'map-delta' && event.delta) {
        this.listeners.onMapDelta?.(event.delta);
      } else if (event.type === 'resource-delta' && event.resources) {
        this.listeners.onResources?.(event.resources);
      }
    }
    if (drained.resyncRequest) {
      this.send({ type: 'request-keyframe', reason: drained.resyncRequest.reason });
    }
  }
}
