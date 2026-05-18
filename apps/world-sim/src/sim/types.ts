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
    | 'pause_changed';
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
  speed: 0 | 1 | 2 | 4;
  paused: boolean;
  tiles: Tile[];
  units: Unit[];
  recentEvents: SimEvent[];
  stats: {
    population: number;
    foodTiles: number;
    totalFood: number;
  };
};
