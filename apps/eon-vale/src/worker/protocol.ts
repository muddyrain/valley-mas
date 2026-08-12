import type {
  Inspection,
  ResourceNodeSnapshot,
  WorldMapDelta,
  WorldMapSnapshot,
  WorldRenderSnapshot,
} from '@/render/renderTypes';
import type { EntityKind, GodPower, MapTool, WorldPreset } from '@/shared/gameTypes';
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
  | { type: 'inspect'; target: 'entity' | 'village' | 'kingdom'; id: number }
  | { type: 'request-save' }
  | { type: 'load-save'; encoded: string };

export type WorkerEvent =
  | { type: 'ready'; mode: 'world' | 'stress'; population: number; seed: string }
  | { type: 'snapshot'; snapshot: PrototypeSnapshot }
  | { type: 'world-snapshot'; snapshot: WorldRenderSnapshot }
  | { type: 'world-map'; map: WorldMapSnapshot }
  | { type: 'world-map-delta'; delta: WorldMapDelta }
  | { type: 'world-resources'; resources: ResourceNodeSnapshot }
  | { type: 'inspection'; inspection: Inspection | null }
  | { type: 'save-data'; encoded: string }
  | { type: 'notice'; level: 'info' | 'error'; message: string }
  | { type: 'metrics'; metrics: PrototypeMetrics };
