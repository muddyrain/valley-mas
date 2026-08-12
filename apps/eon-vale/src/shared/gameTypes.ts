import type { NavigationGrid } from '@/simulation/navigation/grid';

export enum TerrainType {
  DeepOcean = 0,
  Ocean = 0,
  ShallowOcean = 1,
  Beach = 2,
  Grass = 3,
  Forest = 4,
  Desert = 5,
  Snow = 6,
  Mountain = 7,
}

export type WorldPreset = 'archipelago' | 'continent' | 'ocean';

export enum EntityKind {
  Human = 0,
  Chicken = 1,
  Sheep = 2,
  Cow = 3,
  Deer = 4,
  Wolf = 5,
  Bear = 6,
  Fish = 7,
}

export enum AgentState {
  Idle = 0,
  Wander = 1,
  FindFood = 2,
  Eat = 3,
  Rest = 4,
  GatherWood = 5,
  GatherStone = 6,
  Farm = 7,
  Haul = 8,
  Build = 9,
  Repair = 10,
  Flee = 11,
  Guard = 12,
  Chase = 13,
  Attack = 14,
  Home = 15,
}

export enum ResourceNodeKind {
  Tree = 0,
  Stone = 1,
  Metal = 2,
}

export enum ResourceNodeStage {
  Stump = 0,
  Sapling = 1,
  Young = 2,
  Mature = 3,
  Depleted = 4,
}

export enum CarriedResourceKind {
  None = 0,
  Wood = 1,
  Stone = 2,
  Metal = 3,
}

export enum Profession {
  Forager = 0,
  Woodcutter = 1,
  Miner = 2,
  Farmer = 3,
  Builder = 4,
  Hauler = 5,
  Guard = 6,
  Blacksmith = 7,
  Hunter = 8,
  Shepherd = 9,
}

export enum ResidentRole {
  Citizen = 0,
  Veteran = 1,
  Master = 2,
  Captain = 3,
  Leader = 4,
  King = 5,
}

export enum ResidentSex {
  Female = 0,
  Male = 1,
}

export enum BuildingType {
  TownCenter = 0,
  Home = 1,
  Farm = 2,
  Storage = 3,
  Barracks = 4,
  Road = 5,
  LoggingCamp = 6,
  Mine = 7,
  Workshop = 8,
  CouncilHall = 9,
  Wall = 10,
  Watchtower = 11,
}

export enum VillageTier {
  Camp = 0,
  Hamlet = 1,
  Town = 2,
  CityState = 3,
}

export enum DiplomacyState {
  Peace = 0,
  Alliance = 1,
  War = 2,
}

export enum GodPower {
  Rain = 'rain',
  Lightning = 'lightning',
  Fire = 'fire',
  Tornado = 'tornado',
  Meteor = 'meteor',
  Plague = 'plague',
  Blessing = 'blessing',
  Heal = 'heal',
  Rage = 'rage',
  Diplomacy = 'diplomacy',
  Curse = 'curse',
  Growth = 'growth',
  Frost = 'frost',
  Earthquake = 'earthquake',
  Purify = 'purify',
  Fertility = 'fertility',
}

export type MapTool =
  | 'raise'
  | 'lower'
  | 'paint-land'
  | 'paint-water'
  | 'paint-forest'
  | 'place-food'
  | 'place-stone'
  | 'spawn-human'
  | 'spawn-chicken'
  | 'spawn-sheep'
  | 'spawn-cow'
  | 'spawn-deer'
  | 'spawn-wolf'
  | 'spawn-bear'
  | 'spawn-fish'
  | 'erase';

export interface Resources {
  food: number;
  wood: number;
  stone: number;
  metal: number;
  gold: number;
  tools: number;
  equipment: number;
}

export interface WorldMap {
  size: number;
  preset: WorldPreset;
  terrain: Uint8Array;
  height: Float32Array;
  moisture: Uint8Array;
  temperature: Uint8Array;
  resourceFood: Uint16Array;
  resourceWood: Uint16Array;
  resourceStone: Uint16Array;
  fire: Uint8Array;
  rain: Uint8Array;
  plague: Uint8Array;
  crops: Uint8Array;
  craters: Uint8Array;
  roads: Uint8Array;
  navigation: NavigationGrid;
  dirtyMapCells: number[];
}

export interface ResourceRegrowthEvent {
  tick: number;
  nodeId: number;
  stage: ResourceNodeStage;
}

export interface ResourceNodeStore {
  mapSize: number;
  chunkSize: number;
  chunkColumns: number;
  chunkRows: number;
  capacity: number;
  count: number;
  active: Uint8Array;
  kind: Uint8Array;
  positionsX: Float32Array;
  positionsZ: Float32Array;
  amount: Uint16Array;
  maxAmount: Uint16Array;
  stage: Uint8Array;
  variant: Uint8Array;
  reservedBy: Uint32Array;
  reservedUntil: Uint32Array;
  regrowAtTick: Uint32Array;
  chunkHeads: Int32Array;
  nextInChunk: Int32Array;
  chunkRevisions: Uint32Array;
  dirtyNodeIds: number[];
  regrowthQueue: ResourceRegrowthEvent[];
}

export interface EntityArrays {
  capacity: number;
  count: number;
  active: Uint8Array;
  kind: Uint8Array;
  positionsX: Float32Array;
  positionsZ: Float32Array;
  headings: Float32Array;
  health: Uint16Array;
  hunger: Uint16Array;
  energy: Uint16Array;
  age: Uint16Array;
  sex: Uint8Array;
  familyIds: Uint32Array;
  partnerIds: Uint32Array;
  parentAIds: Uint32Array;
  parentBIds: Uint32Array;
  lastBirthTicks: Uint32Array;
  malnutrition: Uint16Array;
  expeditionIds: Uint16Array;
  states: Uint8Array;
  professions: Uint8Array;
  villageIds: Uint16Array;
  kingdomIds: Uint16Array;
  targetCells: Uint32Array;
  traits: Uint8Array;
  speed: Float32Array;
  infected: Uint8Array;
  blessed: Uint16Array;
  enraged: Uint16Array;
  experience: Uint32Array;
  contribution: Uint32Array;
  levels: Uint8Array;
  roles: Uint8Array;
  weaponTiers: Uint8Array;
  armorTiers: Uint8Array;
  carriedResourceKinds: Uint8Array;
  carriedResources: Uint8Array;
  resourceTargetIds: Uint32Array;
  names: string[];
  paths: Array<{ cells: number[]; cursor: number; mapVersion: number } | null>;
}

export interface Building {
  id: number;
  villageId: number;
  type: BuildingType;
  x: number;
  z: number;
  stage: 0 | 1 | 2;
  progress: number;
  requiredProgress: number;
  health: number;
  completed: boolean;
  constructionPhase: 'clearing' | 'delivery' | 'building' | 'complete';
  reservedWood: number;
  reservedStone: number;
  deliveredWood: number;
  deliveredStone: number;
  inTransitWood: number;
  inTransitStone: number;
  clearNodeIds: number[];
}

export interface Village {
  id: number;
  name: string;
  x: number;
  z: number;
  population: number;
  tier: VillageTier;
  health: number;
  resources: Resources;
  storageCapacity: number;
  housingCapacity: number;
  kingdomId: number;
  buildingIds: number[];
  foundedAtTick: number;
  carryingCapacity: number;
  foodProduction: number;
  foodConsumption: number;
  foodTrend: number;
  shortageTicks: number;
  lastBirthTick: number;
  pioneerReadyAtTick: number;
  captureKingdomId?: number;
  captureProgress?: number;
}

export type ShortageStage = 'stable' | 'rationing' | 'migration' | 'famine';

export type DeathCause = 'age' | 'hunger' | 'disease' | 'violence' | 'disaster';

export type DeathCauseCounts = Record<DeathCause, number>;

export interface PopulationHistoryPoint {
  year: number;
  population: number;
  births: number;
  deaths: number;
  migrations: number;
  carryingCapacity: number;
}

export interface PopulationDiagnostics {
  totalBirths: number;
  totalDeaths: number;
  totalMigrations: number;
  birthsThisYear: number;
  deathsThisYear: number;
  migrationsThisYear: number;
  birthsLastYear: number;
  deathsLastYear: number;
  migrationsLastYear: number;
  deathCauses: DeathCauseCounts;
  deathCausesThisYear: DeathCauseCounts;
  carryingCapacity: number;
  housingCapacity: number;
  storedFood: number;
  children: number;
  adults: number;
  elders: number;
  trend: number;
  history: PopulationHistoryPoint[];
}

export interface WorldLaws {
  naturalAnimalReturn: boolean;
  civilizationAwakening: boolean;
}

export type AnimalEcologyStatus =
  | 'not-introduced'
  | 'stable'
  | 'endangered'
  | 'extinct'
  | 'waiting-habitat'
  | 'return-cooldown'
  | 'returning';

export interface SpeciesEcologyDiagnostics {
  kind: EntityKind;
  count: number;
  capacity: number;
  status: AnimalEcologyStatus;
  everPresent: boolean;
  lastReturnTick: number;
}

export interface EcologyDiagnostics {
  animals: number;
  species: SpeciesEcologyDiagnostics[];
  nextReturnTicks: number[];
  extinctSinceTicks: number[];
}

export interface WarCampaign {
  firstKingdomId: number;
  secondKingdomId: number;
  startedAtTick: number;
  initialMilitaryPower: Record<number, number>;
  lastProgressTick: number;
  capturedVillageIds: number[];
  score: Record<number, number>;
  fatigue: Record<number, number>;
}

export interface TruceRecord {
  firstKingdomId: number;
  secondKingdomId: number;
  untilTick: number;
}

export interface PioneerExpedition {
  id: number;
  originVillageId: number;
  kingdomId: number;
  memberIds: number[];
  targetX: number;
  targetZ: number;
  targetCell: number;
  startedAtTick: number;
  supplies: number;
  destinationVillageId?: number;
}

export interface Kingdom {
  id: number;
  name: string;
  color: string;
  leaderId: number;
  villageIds: number[];
  relations: Record<number, DiplomacyState>;
  militaryPower: number;
  extinct: boolean;
  foundedAtTick: number;
}

export interface WorldSettings {
  speed: 1 | 2 | 4 | 8;
  quality: 'low' | 'medium' | 'high';
  overlay: 'none' | 'territory' | 'population' | 'resources' | 'climate' | 'navigation';
}

export interface WorldEvent {
  id: number;
  tick: number;
  kind:
    | 'birth'
    | 'village'
    | 'kingdom'
    | 'war'
    | 'peace'
    | 'disaster'
    | 'construction'
    | 'extinction'
    | 'promotion'
    | 'death'
    | 'equipment'
    | 'ecology'
    | 'awakening'
    | 'conquest';
  message: string;
}

export interface WorldState {
  version: number;
  seed: string;
  tick: number;
  year: number;
  map: WorldMap;
  resourceNodes: ResourceNodeStore;
  entities: EntityArrays;
  villages: Village[];
  kingdoms: Kingdom[];
  buildings: Building[];
  settings: WorldSettings;
  events: WorldEvent[];
  nextRequestId: number;
  nextEventId: number;
  forcedPeaceUntil: number;
  population: PopulationDiagnostics;
  worldLaws: WorldLaws;
  ecology: EcologyDiagnostics;
  humanExtinctSinceTick: number;
  wars: WarCampaign[];
  truces: TruceRecord[];
  expeditions: PioneerExpedition[];
  nextFamilyId: number;
  nextExpeditionId: number;
}
