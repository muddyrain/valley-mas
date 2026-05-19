export type TerrainType = 'grass' | 'forest' | 'hill' | 'water' | 'sand' | 'snow' | 'lava';

export type BiomeType =
  | 'temperate'
  | 'woodland'
  | 'highland'
  | 'coast'
  | 'dryland'
  | 'frozen'
  | 'volcanic';

export type ResourceType = 'food' | 'wood' | 'stone' | 'iron';
export type UnitRace = 'human' | 'orc' | 'elf' | 'dwarf';
export type UnitGender = 'male' | 'female';
export type UnitIntent = 'idle' | 'seek_food' | 'eat' | 'wander' | 'dead';
export type VillageStatus = 'camp' | 'stable' | 'declining';
export type VillageBuildingType = 'hut' | 'storage' | 'farm';
export type VillageBuildingStatus = 'active' | 'abandoned' | 'ruined';
export type KingdomStatus = 'rising' | 'stable' | 'declining' | 'fallen';
export type ArmyGroupStatus = 'marching' | 'fighting' | 'retreating' | 'disbanded';

export type Position = {
  x: number;
  y: number;
};

export type Tile = {
  x: number;
  y: number;
  terrain: TerrainType;
  biome: BiomeType;
  resource?: {
    type: ResourceType;
    amount: number;
  };
};

export type Unit = {
  id: string;
  race: UnitRace;
  gender: UnitGender;
  position: Position;
  hp: number;
  hunger: number;
  ageTicks: number;
  reproductionCooldownTicks: number;
  intent: UnitIntent;
  villageId?: string;
  homeVillageId?: string;
};

export type Village = {
  id: string;
  race: UnitRace;
  kingdomId?: string;
  center: Position;
  population: number;
  foodInventory: number;
  foodCapacity: number;
  housingCapacity: number;
  territoryTiles: number;
  foundedAtTick: number;
  status: VillageStatus;
};

export type Kingdom = {
  id: string;
  race: UnitRace;
  color: number;
  capitalVillageId: string;
  villageIds: string[];
  population: number;
  buildingCount: number;
  territoryTiles: number;
  foodInventory: number;
  diplomacyPressure: number;
  diplomacyTargetKingdomId?: string;
  foundedAtTick: number;
  status: KingdomStatus;
};

export type VillageBuilding = {
  id: string;
  villageId: string;
  type: VillageBuildingType;
  status: VillageBuildingStatus;
  position: Position;
  builtAtTick: number;
};

export type ArmyGroup = {
  id: string;
  kingdomId: string;
  targetKingdomId: string;
  originVillageId: string;
  targetVillageId: string;
  position: Position;
  soldierCount: number;
  morale: number;
  formedAtTick: number;
  status: ArmyGroupStatus;
};

export type TerritoryTile = {
  x: number;
  y: number;
  villageId: string;
  kingdomId?: string;
};

export type WorldProjectionViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
  paddingTiles?: number;
};

export type WorldProjectionOptions = {
  viewport?: WorldProjectionViewport;
};

export type SimCommand =
  | {
      id: string;
      type: 'spawn_unit';
      issuedAtTick: number;
      payload: {
        race: UnitRace;
        gender?: UnitGender;
        position: Position;
        count?: number;
      };
    }
  | {
      id: string;
      type: 'place_resource';
      issuedAtTick: number;
      payload: {
        resourceType: ResourceType;
        position: Position;
        amount: number;
        radius?: number;
      };
    }
  | {
      id: string;
      type: 'change_terrain';
      issuedAtTick: number;
      payload: {
        terrain: TerrainType;
        position: Position;
        radius?: number;
      };
    }
  | {
      id: string;
      type: 'lightning';
      issuedAtTick: number;
      payload: {
        position: Position;
        radius?: number;
        damage?: number;
      };
    }
  | {
      id: string;
      type: 'set_speed';
      issuedAtTick: number;
      payload: {
        speed: 0 | 1 | 2 | 4;
      };
    }
  | {
      id: string;
      type: 'pause';
      issuedAtTick: number;
      payload: {
        paused: boolean;
      };
    };

export type SimEvent = {
  id: string;
  tick: number;
  type:
    | 'command_accepted'
    | 'command_rejected'
    | 'unit_spawned'
    | 'unit_died'
    | 'unit_born'
    | 'unit_ate'
    | 'resource_placed'
    | 'terrain_changed'
    | 'lightning_struck'
    | 'speed_changed'
    | 'pause_changed'
    | 'village_founded'
    | 'village_declining'
    | 'village_abandoned'
    | 'building_built'
    | 'territory_changed'
    | 'kingdom_founded'
    | 'kingdom_joined'
    | 'kingdom_capital_changed'
    | 'kingdom_fallen'
    | 'border_friction'
    | 'resource_pressure'
    | 'diplomacy_pressure'
    | 'war_declared'
    | 'army_formed'
    | 'battle_resolved'
    | 'village_captured'
    | 'army_disbanded';
  message: string;
  sourceCommandId?: string;
  unitId?: string;
  position?: Position;
  payload?: Record<string, string | number | boolean>;
};

export type SimWorldOptions = {
  seed: string;
  width?: number;
  height?: number;
  initialUnits?: number;
};

export type WorldProjection = {
  tick: number;
  seed: string;
  width: number;
  height: number;
  terrainRevision: number;
  viewport?: WorldProjectionViewport;
  speed: 0 | 1 | 2 | 4;
  paused: boolean;
  tiles: Tile[];
  units: Unit[];
  villages: Village[];
  kingdoms: Kingdom[];
  buildings: VillageBuilding[];
  armies: ArmyGroup[];
  territory: TerritoryTile[];
  recentEvents: SimEvent[];
  stats: {
    population: number;
    villages: number;
    kingdoms: number;
    fallenKingdoms: number;
    buildings: number;
    activeArmies: number;
    activeBuildings: number;
    abandonedBuildings: number;
    ruinedBuildings: number;
    territoryTiles: number;
    foodTiles: number;
    totalFood: number;
    totalVillageFood: number;
    housingCapacity: number;
  };
};
