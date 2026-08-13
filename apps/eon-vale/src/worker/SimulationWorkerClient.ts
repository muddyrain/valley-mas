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
  EntityKind,
  GodPower,
  MapTool,
  PlanningZoneKind,
  WorldHistoryArchive,
  WorldHistoryFilter,
  WorldPreset,
} from '@/shared/gameTypes';
import type { PrototypeSnapshot } from '@/simulation/core/prototypeSimulation';
import type { WorldLawId } from '@/simulation/rules/worldLawCatalog';
import type { WorkerCommand, WorkerEvent } from './protocol';

export interface WorkerClientListeners {
  onReady?: (mode: 'world' | 'stress', population: number, seed: string) => void;
  onStressSnapshot?: (snapshot: PrototypeSnapshot) => void;
  onWorldSnapshot?: (snapshot: WorldRenderSnapshot) => void;
  onMap?: (map: WorldMapSnapshot) => void;
  onMapDelta?: (delta: WorldMapDelta) => void;
  onResources?: (resources: ResourceNodeSnapshot) => void;
  onTerritory?: (territory: TerritorySnapshot) => void;
  onInspection?: (inspection: Inspection | null) => void;
  onHistory?: (archive: WorldHistoryArchive) => void;
  onSave?: (encoded: string) => void;
  onNotice?: (level: 'info' | 'error', message: string) => void;
}

export class SimulationWorkerClient {
  private readonly worker = new Worker(new URL('./simulation.worker.ts', import.meta.url), {
    type: 'module',
  });

  constructor(private readonly listeners: WorkerClientListeners = {}) {
    this.worker.addEventListener('message', (event: MessageEvent<WorkerEvent>) => {
      const data = event.data;
      if (data.type === 'ready') this.listeners.onReady?.(data.mode, data.population, data.seed);
      if (data.type === 'snapshot') this.listeners.onStressSnapshot?.(data.snapshot);
      if (data.type === 'world-snapshot') this.listeners.onWorldSnapshot?.(data.snapshot);
      if (data.type === 'world-map') this.listeners.onMap?.(data.map);
      if (data.type === 'world-map-delta') this.listeners.onMapDelta?.(data.delta);
      if (data.type === 'world-resources') this.listeners.onResources?.(data.resources);
      if (data.type === 'world-territory') this.listeners.onTerritory?.(data.territory);
      if (data.type === 'inspection') this.listeners.onInspection?.(data.inspection);
      if (data.type === 'world-history') this.listeners.onHistory?.(data.archive);
      if (data.type === 'save-data') this.listeners.onSave?.(data.encoded);
      if (data.type === 'notice') this.listeners.onNotice?.(data.level, data.message);
    });
  }

  initializeStress(population: number, seed: string): void {
    this.send({ type: 'initialize-stress', population, seed });
  }

  initializeWorld(
    seed: string,
    initialHumans = 72,
    mapSize: 128 | 256 | 384 = 256,
    preset: WorldPreset = 'archipelago',
  ): void {
    this.send({ type: 'initialize-world', seed, initialHumans, mapSize, preset });
  }

  setPaused(paused: boolean): void {
    this.send({ type: 'set-paused', paused });
  }

  setSpeed(speed: 1 | 2 | 4 | 8): void {
    this.send({ type: 'set-speed', speed });
  }

  setWorldLaw(law: WorldLawId, enabled: boolean): void {
    this.send({ type: 'set-world-law', law, enabled });
  }

  editMap(tool: MapTool, cell: number, radius: number): void {
    this.send({ type: 'map-edit', tool, cell, radius });
  }

  spawn(kind: EntityKind, cell: number, count = 1): void {
    this.send({ type: 'spawn', kind, cell, count });
  }

  useGodPower(power: GodPower, cell: number, radius: number): void {
    this.send({ type: 'god-power', power, cell, radius });
  }

  inspect(target: 'entity' | 'village' | 'building' | 'kingdom', id: number): void {
    this.send({ type: 'inspect', target, id });
  }

  requestHistory(filter: WorldHistoryFilter): void {
    this.send({ type: 'request-history', filter });
  }

  setFavorite(lifeId: number, favorite: boolean): void {
    this.send({ type: 'set-favorite', lifeId, favorite });
  }

  setConstructionPriority(villageId: number, priority: ConstructionPriority): void {
    this.send({ type: 'set-construction-priority', villageId, priority });
  }

  paintPlanningZone(villageId: number, zone: PlanningZoneKind, cell: number, radius = 2): void {
    this.send({ type: 'paint-planning-zone', villageId, zone, cell, radius });
  }

  requestSave(): void {
    this.send({ type: 'request-save' });
  }

  loadSave(encoded: string): void {
    this.send({ type: 'load-save', encoded });
  }

  dispose(): void {
    this.worker.terminate();
  }

  private send(command: WorkerCommand): void {
    this.worker.postMessage(command);
  }
}
