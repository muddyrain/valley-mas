import type {
  Building,
  Kingdom,
  PopulationDiagnostics,
  Village,
  WorldEvent,
  WorldPreset,
  WorldSettings,
} from '@/shared/gameTypes';
import type { PrototypeMetrics } from '@/simulation/core/prototypeSimulation';

export interface RenderSnapshot {
  tick: number;
  population: number;
  active?: Uint8Array;
  positionsX: Float32Array;
  positionsZ: Float32Array;
  headings: Float32Array;
  states: Uint8Array;
  kinds?: Uint8Array;
  kingdomIds?: Uint16Array;
  health?: Uint16Array;
  infected?: Uint8Array;
  professions?: Uint8Array;
  levels?: Uint8Array;
  roles?: Uint8Array;
  weaponTiers?: Uint8Array;
  armorTiers?: Uint8Array;
  ages?: Uint16Array;
  metrics: PrototypeMetrics;
}

export interface WorldStats {
  year: number;
  humans: number;
  animals: number;
  villages: number;
  kingdoms: number;
  wars: number;
  populationTrend: number;
}

export interface WorldRenderSnapshot extends RenderSnapshot {
  year: number;
  active: Uint8Array;
  kinds: Uint8Array;
  kingdomIds: Uint16Array;
  health: Uint16Array;
  infected: Uint8Array;
  professions: Uint8Array;
  levels: Uint8Array;
  roles: Uint8Array;
  weaponTiers: Uint8Array;
  armorTiers: Uint8Array;
  ages: Uint16Array;
  stats: WorldStats;
  villages: Village[];
  kingdoms: Kingdom[];
  buildings: Building[];
  events: WorldEvent[];
  settings: WorldSettings;
  demographics: PopulationDiagnostics;
}

export interface WorldMapSnapshot {
  size: number;
  preset: WorldPreset;
  terrain: Uint8Array;
  height: Float32Array;
  moisture: Uint8Array;
  temperature: Uint8Array;
  resourceFood: Uint16Array;
  fire: Uint8Array;
  rain: Uint8Array;
  plague: Uint8Array;
  crops: Uint8Array;
  craters: Uint8Array;
  roads: Uint8Array;
  changedChunks: number[];
  fullRebuild: boolean;
}

export interface WorldMapDelta {
  cells: Uint32Array;
  terrain: Uint8Array;
  height: Float32Array;
  moisture: Uint8Array;
  temperature: Uint8Array;
  resourceFood: Uint16Array;
  fire: Uint8Array;
  rain: Uint8Array;
  plague: Uint8Array;
  crops: Uint8Array;
  craters: Uint8Array;
  roads: Uint8Array;
}

export interface ResourceNodeSnapshot {
  full: boolean;
  count: number;
  nodeIds: Uint32Array;
  active: Uint8Array;
  kind: Uint8Array;
  positionsX: Float32Array;
  positionsZ: Float32Array;
  amount: Uint16Array;
  stage: Uint8Array;
  variant: Uint8Array;
}

export interface EntityInspection {
  type: 'entity';
  id: number;
  name: string;
  kind: number;
  age: number;
  health: number;
  hunger: number;
  energy: number;
  profession: number;
  state: number;
  villageName: string;
  kingdomName: string;
  targetCell: number | null;
  traits: number;
  level: number;
  experience: number;
  contribution: number;
  role: number;
  weaponTier: number;
  armorTier: number;
  sex: number;
  familyId: number;
  partnerName: string;
  parentNames: string[];
  malnutrition: number;
  history: Array<{ tick: number; message: string }>;
}

export interface VillageInspection {
  type: 'village';
  id: number;
  village: Village;
  completedBuildings: number;
  kingdomName: string;
}

export interface KingdomInspection {
  type: 'kingdom';
  id: number;
  kingdom: Kingdom;
  population: number;
  resources: { food: number; wood: number; stone: number };
}

export type Inspection = EntityInspection | VillageInspection | KingdomInspection;
