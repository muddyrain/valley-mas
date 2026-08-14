import type {
  Building,
  EcologyDiagnostics,
  Kingdom,
  PopulationDiagnostics,
  ResidentTask,
  Village,
  WorldEvent,
  WorldHistoryEntry,
  WorldLaws,
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
  villageIds?: Uint16Array;
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
  villageIds: Uint16Array;
  kingdomIds: Uint16Array;
  health: Uint16Array;
  infected: Uint8Array;
  professions: Uint8Array;
  levels: Uint8Array;
  roles: Uint8Array;
  weaponTiers: Uint8Array;
  armorTiers: Uint8Array;
  ages: Uint16Array;
  targetCells: Uint32Array;
  carriedResourceKinds: Uint8Array;
  carriedResources: Uint8Array;
  stats: WorldStats;
  villages: Village[];
  kingdoms: Kingdom[];
  buildings: Building[];
  events: WorldEvent[];
  historyRevision: number;
  settings: WorldSettings;
  demographics: PopulationDiagnostics;
  worldLaws: WorldLaws;
  ecology: EcologyDiagnostics;
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

export interface TerritorySnapshot {
  full: boolean;
  revision: number;
  cells: Uint32Array;
  villageIds: Uint16Array;
  claimStrength: Uint8Array;
  planningZoneKinds: Uint8Array;
}

export interface EntityInspection {
  type: 'entity';
  id: number;
  lifeId: number;
  favorite: boolean;
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
  history: WorldHistoryEntry[];
  task: ResidentTask | null;
  carriedResourceKind: number;
  carriedResourceAmount: number;
  homeName: string;
  workplaceName: string;
}

export interface VillageInspection {
  type: 'village';
  id: number;
  village: Village;
  completedBuildings: number;
  kingdomName: string;
  development: {
    nextTier: number | null;
    population: number;
    requiredPopulation: number;
    buildings: Array<{ type: number; current: number; required: number }>;
  };
  planningZones: { residential: number; production: number; defense: number };
  capabilities: {
    guardTrainingSlots: number;
    territoryReachBonus: number;
    claimStrengthBonus: number;
    captureBlockers: number;
    watchtowers: number;
    watchRange: number;
    watchDamage: number;
  };
  workHotspots: Array<{ kind: string; count: number; x: number; z: number }>;
  history: WorldHistoryEntry[];
}

export interface BuildingInspection {
  type: 'building';
  id: number;
  building: Building;
  villageName: string;
  workerNames: string[];
  capability: string;
  inputs: string;
  outputs: string;
  stopReason: string;
}

export interface KingdomInspection {
  type: 'kingdom';
  id: number;
  kingdom: Kingdom;
  population: number;
  resources: { food: number; wood: number; stone: number };
  capital: { id: number; name: string; x: number; z: number } | null;
  villages: Array<{
    id: number;
    name: string;
    population: number;
    tier: number;
    isCapital: boolean;
  }>;
  neighbours: Array<{
    id: number;
    name: string;
    relation: number;
    sharedEdges: number;
    diagonalOnly: boolean;
  }>;
  history: WorldHistoryEntry[];
}

export type Inspection =
  | EntityInspection
  | VillageInspection
  | BuildingInspection
  | KingdomInspection;
