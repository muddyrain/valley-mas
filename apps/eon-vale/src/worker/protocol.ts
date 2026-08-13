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
  WorldPreset,
} from '@/shared/gameTypes';
import type { PrototypeMetrics, PrototypeSnapshot } from '@/simulation/core/prototypeSimulation';
import type { WorldLawId } from '@/simulation/rules/worldLawCatalog';

export type WorkerCommand =
  | { type: 'initialize-stress'; population: number; seed: string }
  | {
      type: 'initialize-world';
      seed: string;
      initialHumans: number;
      mapSize: 128 | 256 | 384;
      preset: WorldPreset;
    }
  | { type: 'set-paused'; paused: boolean }
  | { type: 'set-speed'; speed: 1 | 2 | 4 | 8 }
  | { type: 'set-world-law'; law: WorldLawId; enabled: boolean }
  | { type: 'map-edit'; tool: MapTool; cell: number; radius: number }
  | { type: 'spawn'; kind: EntityKind; cell: number; count: number }
  | { type: 'god-power'; power: GodPower; cell: number; radius: number }
  | { type: 'inspect'; target: 'entity' | 'village' | 'building' | 'kingdom'; id: number }
  | { type: 'set-construction-priority'; villageId: number; priority: ConstructionPriority }
  | {
      type: 'paint-planning-zone';
      villageId: number;
      zone: PlanningZoneKind;
      cell: number;
      radius: number;
    }
  | { type: 'request-save' }
  | { type: 'load-save'; encoded: string };

export type WorkerEvent =
  | { type: 'ready'; mode: 'world' | 'stress'; population: number; seed: string }
  | { type: 'snapshot'; snapshot: PrototypeSnapshot }
  | { type: 'world-snapshot'; snapshot: WorldRenderSnapshot }
  | { type: 'world-map'; map: WorldMapSnapshot }
  | { type: 'world-map-delta'; delta: WorldMapDelta }
  | { type: 'world-resources'; resources: ResourceNodeSnapshot }
  | { type: 'world-territory'; territory: TerritorySnapshot }
  | { type: 'inspection'; inspection: Inspection | null }
  | { type: 'save-data'; encoded: string }
  | { type: 'notice'; level: 'info' | 'error'; message: string }
  | { type: 'metrics'; metrics: PrototypeMetrics };
