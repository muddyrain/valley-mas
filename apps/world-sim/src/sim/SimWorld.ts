import {
  createWorldMap,
  forEachTileInRadius,
  getTile,
  isWalkable,
  resourceTotals,
  type TileBounds,
  tilesInBounds,
} from './map';
import { SeededRng } from './rng';
import { SpatialIndex } from './spatialIndex';
import type {
  ArmyGroup,
  BattleMarker,
  Kingdom,
  Position,
  ResourceType,
  SimCommand,
  SimEvent,
  SimStepPhaseTimings,
  SimWorldOptions,
  TerrainType,
  Tile,
  Unit,
  UnitGender,
  UnitRace,
  Village,
  VillageBuilding,
  VillageBuildingType,
  VillageBuildPlan,
  VillageGrowthBlocker,
  VillageJobs,
  VillageWorkSite,
  WorldProjection,
  WorldProjectionOptions,
  WorldProjectionViewport,
} from './types';

const MAX_HP = 100;
const MAX_HUNGER = 100;
const HUNGER_GAIN_PER_TICK = 0.7;
const STARVATION_DAMAGE_PER_TICK = 1.4;
const OLD_AGE_TICKS = 60 * 240;
const ADULT_AGE_TICKS = 12 * 240;
const REPRODUCTION_COOLDOWN_TICKS = 240 * 3;
const UNIT_BEHAVIOR_INTERVAL_TICKS = 4;
const SEEK_FOOD_RADIUS = 12;
const REPRODUCTION_RADIUS = 3;
const BASE_BIRTH_CHANCE = 0.008;
const LIGHTNING_DAMAGE = 60;
const MAX_COMMAND_RADIUS = 16;
const MAX_SPAWN_COUNT = 200;
const STARTING_REPRODUCTION_COOLDOWN_TICKS = REPRODUCTION_COOLDOWN_TICKS;
const VILLAGE_FOUNDING_POPULATION = 8;
const VILLAGE_RADIUS = 7;
const VILLAGE_FOOD_RADIUS = 8;
const VILLAGE_WOOD_RADIUS = 8;
const VILLAGE_WOOD_SCOUT_RADIUS = 18;
const VILLAGE_MIN_LOCAL_FOOD = 30;
const VILLAGE_INITIAL_FORAGE = 24;
const VILLAGE_FORAGE_PER_TICK = 3;
const VILLAGE_CONSUMPTION_INTERVAL_TICKS = 30;
const VILLAGE_CAMP_FOOD_PER_RESIDENT = 1;
const VILLAGE_FOOD_PER_RESIDENT = 2;
const VILLAGE_BASE_HOUSING = 12;
const VILLAGE_MAX_HOUSING = 60;
const VILLAGE_BASE_FOOD_CAPACITY = 120;
const HOUSE_HOUSING_BONUS = 6;
const STORAGE_FOOD_CAPACITY_BONUS = 140;
const FARM_FOOD_PER_TICK = 3;
const BASE_FARMER_FOOD_PER_TICK = 1;
const MINE_RESOURCE_PER_TICK = 2;
const WOOD_PER_BUILDER_TICK = 2;
const CONSTRUCTION_WORK_PER_BUILDER_TICK = 8;
const BUILDING_INTERVAL_TICKS = 60;
const BUILDING_RUIN_TICKS = 240;
const WORK_SITE_VISIBLE_TICKS = 60;
const WORK_SITE_TERRITORY_RADIUS = 2;
const HOUSING_PRESSURE_RATIO = 0.75;
const SETTLEMENT_TERRITORY_BASE_RADIUS = 3;
const SETTLEMENT_TERRITORY_MAX_RADIUS = 8;
const PROSPERITY_BUILD_MIN_POPULATION = 20;
const PROSPERITY_BUILD_MIN_WOOD = 80;
const PROSPERITY_BUILD_FOOD_FILL_RATIO = 0.65;
const VILLAGE_SHALLOW_QUARRY_RADIUS = 6;
const VILLAGE_SHALLOW_QUARRY_AMOUNT = 80;
const VILLAGE_EXPANSION_INTERVAL_TICKS = 120;
const VILLAGE_EXPANSION_MIN_POPULATION = 18;
const VILLAGE_EXPANSION_SETTLERS = 8;
const VILLAGE_EXPANSION_MIN_RADIUS = 16;
const VILLAGE_EXPANSION_MAX_RADIUS = 28;
const VILLAGE_EXPANSION_FOOD_COST = 90;
const VILLAGE_EXPANSION_WOOD_COST = 20;
type BuildingResourceCost = {
  food: number;
  wood: number;
  stone: number;
  iron: number;
};
const BUILDING_COSTS: Record<VillageBuildingType, BuildingResourceCost> = {
  town_hall: { food: 0, wood: 0, stone: 0, iron: 0 },
  house: { food: 0, wood: 18, stone: 0, iron: 0 },
  storage: { food: 0, wood: 24, stone: 0, iron: 0 },
  farm: { food: 0, wood: 16, stone: 0, iron: 0 },
  mine: { food: 0, wood: 20, stone: 0, iron: 0 },
  barrack: { food: 0, wood: 28, stone: 10, iron: 0 },
  dock: { food: 0, wood: 24, stone: 0, iron: 0 },
};
const BUILDING_WORK_REQUIRED: Record<VillageBuildingType, number> = {
  town_hall: 0,
  house: 32,
  storage: 40,
  farm: 44,
  mine: 52,
  barrack: 64,
  dock: 52,
};
const TOWN_HALL_UPGRADE_COSTS = [0, 120, 220];
const HOUSE_UPGRADE_COSTS: Array<BuildingResourceCost | undefined> = [
  undefined,
  { food: 0, wood: 14, stone: 0, iron: 0 },
  { food: 0, wood: 22, stone: 6, iron: 0 },
];
const TOWN_HALL_UPGRADE_REQUIREMENTS = [
  undefined,
  { population: 12, buildings: 6, food: 500 },
  { population: 12, buildings: 8, food: 900 },
] as const;
const BUILDING_TERRITORY_RADIUS = 4;
const MINE_SITE_RADIUS = 8;
const DOCK_SITE_RADIUS = 9;
const KINGDOM_FOUNDING_POPULATION = 6;
const KINGDOM_FOUNDING_BUILDINGS = 2;
const KINGDOM_JOIN_RADIUS = 60;
const DIPLOMACY_INTERACTION_RANGE = 80;
const DIPLOMACY_BORDER_RANGE = 28;
const DIPLOMACY_BORDER_PRESSURE_PER_TILE = 1.2;
const DIPLOMACY_FOOD_TARGET_PER_RESIDENT = 6;
const DIPLOMACY_RESOURCE_PRESSURE_PER_FOOD = 2.2;
const DIPLOMACY_DECAY_PER_TICK = 0.35;
const DIPLOMACY_PRESSURE_REPORT_STEP = 25;
const DIPLOMACY_CAUSE_REPORT_STEP = 5;
const DIPLOMACY_WAR_DECLARATION_PRESSURE = 120;
const ARMY_MOBILIZATION_RATIO = 0.58;
const BARRACK_MOBILIZATION_RATIO_BONUS = 0.22;
const SOLDIER_JOB_MOBILIZATION_BONUS = 0.015;
const SOLDIER_JOB_CAP_BONUS = 2;
const ARMY_MIN_SOLDIERS = 4;
const ARMY_MAX_SOLDIERS = 32;
const ARMY_BARRACK_MAX_SOLDIERS = 42;
const ARMY_SPEED_PER_TICK = 0.8;
const ARMY_BATTLE_DISTANCE = 1.2;
const ARMY_BATTLE_CASUALTY_INTERVAL_TICKS = 12;
const ARMY_OCCUPATION_PROGRESS_PER_TICK = 3.2;
const ARMY_REFORM_COOLDOWN_TICKS = 360;
const ARMY_GROUPS_PER_WAR = 3;
const FORCED_PEACE_TRUCE_TICKS = 720;
const DEFENDER_POPULATION_STRENGTH = 0.42;
const DEFENDER_BUILDING_STRENGTH = 1.8;
const KINGDOM_COLORS = [
  0xef7d57, 0xffcd75, 0x38b764, 0x29adff, 0x9b5de5, 0xf15bb5, 0x00f5d4, 0xc2c3c7,
];
const VILLAGE_NAME_POOLS: Record<UnitRace, string[]> = {
  human: ['晨林', '河湾', '青川', '星原', '暖风', '白石'],
  orc: ['铁牙', '黑脊', '裂石', '灰岩', '赤角', '荒谷'],
  elf: ['银叶', '露泉', '风歌', '月湾', '花岚', '星枝'],
  dwarf: ['岩炉', '石歌', '铜岭', '铁砧', '深谷', '炉堡'],
};
const RECENT_EVENT_TYPES = new Set<SimEvent['type']>([
  'command_accepted',
  'command_rejected',
  'resource_placed',
  'terrain_changed',
  'lightning_struck',
  'speed_changed',
  'pause_changed',
  'village_founded',
  'village_leveled_up',
  'village_declining',
  'village_abandoned',
  'building_built',
  'building_upgraded',
  'building_ruined',
  'kingdom_founded',
  'kingdom_joined',
  'kingdom_capital_changed',
  'kingdom_fallen',
  'border_friction',
  'resource_pressure',
  'war_declared',
  'peace_forced',
  'army_formed',
  'battle_resolved',
  'village_captured',
  'army_disbanded',
]);
const RECENT_EVENTS_LIMIT = 24;

type KingdomDiplomacyRelation = {
  pressure: number;
  warDeclared: boolean;
  armyFormed: boolean;
  aggressorKingdomId?: string;
  targetKingdomId?: string;
  nextArmyReadyTick?: number;
  truceUntilTick?: number;
  pressureReportTier: number;
  borderReportTier: number;
  resourceReportTier: number;
};

export class SimWorld {
  readonly seed: string;
  readonly map;

  speed: 0 | 1 | 2 | 4 = 1;
  paused = false;

  private readonly rng: SeededRng;
  private readonly commands: SimCommand[] = [];
  private readonly events: SimEvent[] = [];
  private readonly units = new Map<string, Unit>();
  private readonly villages = new Map<string, Village>();
  private readonly villageResidents = new Map<string, Unit[]>();
  private readonly kingdoms = new Map<string, Kingdom>();
  private readonly diplomacy = new Map<string, KingdomDiplomacyRelation>();
  private readonly buildings = new Map<string, VillageBuilding>();
  private readonly armies = new Map<string, ArmyGroup>();
  private readonly spatialIndex = new SpatialIndex();
  private tick = 0;
  private terrainRevision = 0;
  private nextUnitId = 1;
  private nextEventId = 1;
  private nextVillageId = 1;
  private nextKingdomId = 1;
  private nextBuildingId = 1;
  private nextArmyId = 1;
  private readonly workSites = new Map<string, VillageWorkSite>();

  constructor(options: SimWorldOptions) {
    this.seed = options.seed;
    this.rng = new SeededRng(`${options.seed}:world`);
    this.map = createWorldMap(options.seed, options.width, options.height);
    this.spawnInitialUnits(options.initialUnits ?? 24);
    this.spatialIndex.rebuild([...this.units.values()]);
  }

  get currentTick() {
    return this.tick;
  }

  enqueue(command: SimCommand) {
    this.commands.push(command);
  }

  step() {
    this.runStep();
  }

  stepProfiled(): SimStepPhaseTimings {
    return this.runStep(true);
  }

  private runStep(profile = false): SimStepPhaseTimings {
    const timings = createEmptyStepPhaseTimings();
    const totalStart = profile ? performance.now() : 0;

    if (this.paused || this.speed === 0) {
      return timings;
    }

    this.tick += 1;
    this.pruneWorkSites();
    timings.commandDrain = this.measureStepPhase(profile, () => this.drainCommands());
    timings.spatialIndexRebuildBeforeVillages = this.measureStepPhase(profile, () =>
      this.spatialIndex.rebuild([...this.units.values()]),
    );
    timings.formVillages = this.measureStepPhase(profile, () => this.formVillages());
    timings.rebuildVillageResidentsIndex = this.measureStepPhase(profile, () =>
      this.rebuildVillageResidentsIndex(),
    );
    timings.updateUnits = this.measureStepPhase(profile, () => {
      const unitTimings = this.updateUnits(profile);
      timings.updateUnitNeeds = unitTimings.updateUnitNeeds;
      timings.nearbyFoodLookup = unitTimings.nearbyFoodLookup;
      timings.nearestFoodLookup = unitTimings.nearestFoodLookup;
      timings.unitMovement = unitTimings.unitMovement;
      timings.reproduction = unitTimings.reproduction;
      timings.removeDeadUnits = unitTimings.removeDeadUnits;
      timings.unitBehaviorCandidates = unitTimings.unitBehaviorCandidates;
      timings.unitBehaviorUpdates = unitTimings.unitBehaviorUpdates;
      timings.unitBehaviorSkipped = unitTimings.unitBehaviorSkipped;
    });
    timings.spatialIndexRebuildBeforeVillagesUpdate = this.measureStepPhase(profile, () =>
      this.spatialIndex.rebuild([...this.units.values()]),
    );
    timings.updateVillages = this.measureStepPhase(profile, () => {
      const villageTimings = this.updateVillages(profile);
      timings.updateVillagePresence = villageTimings.updateVillagePresence;
      timings.updateVillageResidents = villageTimings.updateVillageResidents;
      timings.updateVillageEconomy = villageTimings.updateVillageEconomy;
      timings.updateVillageConsumption = villageTimings.updateVillageConsumption;
    });
    this.updateBuildingDecay();
    timings.updateKingdoms = this.measureStepPhase(profile, () => this.updateKingdoms());
    timings.updateDiplomacy = this.measureStepPhase(profile, () => this.updateDiplomacy());
    timings.updateArmies = this.measureStepPhase(profile, () => this.updateArmies());
    timings.spatialIndexRebuildAfterArmies = this.measureStepPhase(profile, () =>
      this.spatialIndex.rebuild([...this.units.values()]),
    );

    if (profile) {
      timings.total = performance.now() - totalStart;
    }

    return timings;
  }

  private measureStepPhase(profile: boolean, run: () => void) {
    if (!profile) {
      run();
      return 0;
    }

    const start = performance.now();
    run();
    return performance.now() - start;
  }

  project(options: WorldProjectionOptions = {}): WorldProjection {
    const bounds = options.viewport
      ? viewportToTileBounds(options.viewport, this.map.width, this.map.height)
      : undefined;
    const food = resourceTotals(this.map.tiles, 'food');
    const territory = this.projectTerritory();
    const visibleTerritory = bounds
      ? territory.filter((tile) => isTileInBounds(tile, bounds))
      : territory;
    const territoryByVillage = this.countTerritoryByVillage(territory);
    const allUnits = [...this.units.values()];
    const units = allUnits
      .filter((unit) => !bounds || isPositionInBounds(unit.position, bounds))
      .map((unit) => cloneUnit(unit));
    const villages = [...this.villages.values()].map((village) =>
      cloneVillage(village, territoryByVillage.get(village.id) ?? 0),
    );
    const buildings = [...this.buildings.values()]
      .filter((building) => !bounds || isPositionInBounds(building.position, bounds))
      .map((building) => cloneBuilding(building));
    const kingdoms = [...this.kingdoms.values()].map((kingdom) => cloneKingdom(kingdom));
    const armies = [...this.armies.values()]
      .filter((army) => !bounds || isPositionInBounds(army.position, bounds))
      .map((army) => cloneArmy(army));
    const battleMarkers = this.projectBattleMarkers(bounds);
    const workSites = [...this.workSites.values()]
      .filter((site) => site.expiresAtTick >= this.tick)
      .filter((site) => !bounds || isPositionInBounds(site.position, bounds))
      .map((site) => cloneWorkSite(site));
    const allBuildings = [...this.buildings.values()];
    const allArmies = [...this.armies.values()];
    const activeBuildings = allBuildings.filter((building) => building.status === 'active').length;
    const activeArmies = allArmies.filter((army) => army.status !== 'disbanded').length;
    const abandonedBuildings = allBuildings.filter(
      (building) => building.status === 'abandoned',
    ).length;
    const ruinedBuildings = allBuildings.filter((building) => building.status === 'ruined').length;
    const totalVillageFood = villages.reduce((total, village) => total + village.foodInventory, 0);
    const totalVillageWood = villages.reduce((total, village) => total + village.woodInventory, 0);
    const totalVillageStone = villages.reduce(
      (total, village) => total + village.stoneInventory,
      0,
    );
    const totalVillageIron = villages.reduce((total, village) => total + village.ironInventory, 0);
    const housingCapacity = villages.reduce((total, village) => total + village.housingCapacity, 0);
    const activeKingdoms = kingdoms.filter((kingdom) => kingdom.status !== 'fallen').length;
    const fallenKingdoms = kingdoms.length - activeKingdoms;
    const tiles = bounds ? tilesInBounds(this.map, bounds) : this.map.tiles;

    return {
      tick: this.tick,
      seed: this.seed,
      width: this.map.width,
      height: this.map.height,
      terrainRevision: this.terrainRevision,
      viewport: options.viewport ? normalizeViewport(options.viewport) : undefined,
      speed: this.speed,
      paused: this.paused,
      tiles: tiles.map((tile) => ({
        ...tile,
        resource: tile.resource ? { ...tile.resource } : undefined,
      })),
      units,
      villages,
      kingdoms,
      buildings,
      armies,
      battleMarkers,
      territory: visibleTerritory,
      workSites,
      recentEvents: this.events
        .filter((event) => RECENT_EVENT_TYPES.has(event.type))
        .slice(-RECENT_EVENTS_LIMIT)
        .map((event) => ({ ...event })),
      stats: {
        population: allUnits.length,
        villages: villages.length,
        kingdoms: activeKingdoms,
        fallenKingdoms,
        buildings: allBuildings.length,
        activeArmies,
        activeBuildings,
        abandonedBuildings,
        ruinedBuildings,
        territoryTiles: territory.length,
        foodTiles: food.tileCount,
        totalFood: food.amount,
        totalVillageFood,
        totalVillageWood,
        totalVillageStone,
        totalVillageIron,
        housingCapacity,
      },
    };
  }

  private projectBattleMarkers(bounds?: TileBounds): BattleMarker[] {
    const markers: BattleMarker[] = [];

    for (const army of this.armies.values()) {
      if (army.status !== 'fighting') {
        continue;
      }

      const targetVillage = this.villages.get(army.targetVillageId);

      if (!targetVillage) {
        continue;
      }

      const attackerCount = Math.max(1, Math.min(8, Math.ceil(army.soldierCount / 5)));
      const defenderCount = Math.max(1, Math.min(8, Math.ceil(targetVillage.population / 8)));

      markers.push(
        ...this.projectBattleMarkerSide(
          army,
          army.kingdomId,
          'attacker',
          army.position,
          attackerCount,
          army.soldierCount,
          bounds,
        ),
        ...this.projectBattleMarkerSide(
          army,
          army.targetKingdomId,
          'defender',
          targetVillage.center,
          defenderCount,
          targetVillage.population,
          bounds,
        ),
      );
    }

    return markers;
  }

  private projectBattleMarkerSide(
    army: ArmyGroup,
    kingdomId: string,
    side: BattleMarker['side'],
    center: Position,
    markerCount: number,
    representedCount: number,
    bounds?: TileBounds,
  ): BattleMarker[] {
    const markers: BattleMarker[] = [];
    const sideOffset = side === 'attacker' ? -0.65 : 0.65;

    for (let index = 0; index < markerCount; index += 1) {
      const angle = (index / markerCount) * Math.PI * 2 + (side === 'attacker' ? 0 : Math.PI / 8);
      const radius = 0.45 + (index % 3) * 0.28;
      const position = {
        x: clamp(center.x + Math.cos(angle) * radius + sideOffset, 0, this.map.width - 1),
        y: clamp(center.y + Math.sin(angle) * radius, 0, this.map.height - 1),
      };

      if (bounds && !isPositionInBounds(position, bounds)) {
        continue;
      }

      markers.push({
        id: `${army.id}-${side}-${index}`,
        armyId: army.id,
        kingdomId,
        side,
        position: {
          x: round(position.x),
          y: round(position.y),
        },
        count: representedCount,
      });
    }

    return markers;
  }

  serializeForReplay() {
    return JSON.stringify({
      tick: this.tick,
      speed: this.speed,
      paused: this.paused,
      units: [...this.units.values()].map((unit) => ({
        id: unit.id,
        race: unit.race,
        gender: unit.gender,
        x: round(unit.position.x),
        y: round(unit.position.y),
        hp: round(unit.hp),
        hunger: round(unit.hunger),
        ageTicks: unit.ageTicks,
        reproductionCooldownTicks: unit.reproductionCooldownTicks,
        intent: unit.intent,
        villageId: unit.villageId,
        homeVillageId: unit.homeVillageId,
      })),
      resources: this.map.tiles
        .filter((tile) => tile.resource && tile.resource.amount > 0)
        .map((tile) => `${tile.x},${tile.y},${tile.resource?.type},${tile.resource?.amount}`)
        .join('|'),
      villages: [...this.villages.values()].map(
        (village) =>
          `${village.id}:${village.race}:${round(village.center.x)},${round(
            village.center.y,
          )}:${village.name}:${village.level}:${village.population}:${round(
            village.foodInventory,
          )}:${village.housingCapacity}:${
            village.status
          }:${round(village.woodInventory)}:${round(village.stoneInventory)}:${round(
            village.ironInventory,
          )}:${village.jobs.farmer},${village.jobs.builder},${village.jobs.miner},${
            village.jobs.soldier
          }`,
      ),
      buildings: [...this.buildings.values()].map(
        (building) =>
          `${building.id}:${building.villageId}:${building.type}:${round(
            building.position.x,
          )},${round(building.position.y)}:${building.status}:${building.tier ?? 0}:${
            building.constructionProgress ?? 0
          }:${building.constructionWorkRequired ?? 0}:${building.abandonedAtTick ?? ''}:${
            building.ruinedAtTick ?? ''
          }`,
      ),
      kingdoms: [...this.kingdoms.values()].map(
        (kingdom) =>
          `${kingdom.id}:${kingdom.race}:${kingdom.capitalVillageId}:${
            kingdom.villageIds.length
          }:${kingdom.population}:${kingdom.buildingCount}:${kingdom.territoryTiles}:${
            kingdom.status
          }:${round(kingdom.diplomacyPressure)}:${kingdom.diplomacyTargetKingdomId ?? ''}`,
      ),
      armies: [...this.armies.values()].map(
        (army) =>
          `${army.id}:${army.kingdomId}:${army.targetKingdomId}:${army.originVillageId}:${
            army.targetVillageId
          }:${round(army.position.x)},${round(army.position.y)}:${army.soldierCount}:${
            army.trainedSoldiers
          }:${army.status}:${round(army.occupationProgress ?? 0)}`,
      ),
      events: this.events.map((event) => `${event.tick}:${event.type}:${event.message}`),
    });
  }

  private drainCommands() {
    while (this.commands.length > 0) {
      const command = this.commands.shift();

      if (!command) {
        continue;
      }

      this.applyCommand(command);
    }
  }

  private applyCommand(command: SimCommand) {
    const rejection = this.validateCommand(command);

    if (rejection) {
      this.reject(command, rejection);
      return;
    }

    switch (command.type) {
      case 'spawn_unit':
        this.accept(command, 'Spawn life command accepted');
        this.spawnUnits(
          command.payload.position,
          command.payload.race,
          command.payload.count ?? 1,
          command.payload.gender,
        );
        break;
      case 'place_resource':
        this.accept(command, 'Place resource command accepted');
        this.placeResource(
          command.payload.position,
          command.payload.resourceType,
          command.payload.amount,
          command.payload.radius ?? 0,
          command.id,
        );
        break;
      case 'change_terrain':
        this.accept(command, 'Change terrain command accepted');
        this.changeTerrain(
          command.payload.position,
          command.payload.terrain,
          command.payload.radius ?? 0,
          command.id,
        );
        break;
      case 'lightning':
        this.accept(command, 'Lightning command accepted');
        this.strikeLightning(
          command.payload.position,
          command.payload.radius ?? 2,
          command.payload.damage ?? LIGHTNING_DAMAGE,
          command.id,
        );
        break;
      case 'set_speed':
        this.speed = command.payload.speed;
        this.emit(
          'speed_changed',
          `Speed changed to ${this.speed}x`,
          command.id,
          undefined,
          undefined,
          {
            speed: this.speed,
          },
        );
        break;
      case 'pause':
        this.paused = command.payload.paused;
        this.emit(
          'pause_changed',
          this.paused ? 'Simulation paused' : 'Simulation resumed',
          command.id,
          undefined,
          undefined,
          {
            paused: this.paused,
          },
        );
        break;
      case 'force_war':
        this.accept(command, 'Force war command accepted');
        this.forceWar(
          command.payload.aggressorKingdomId,
          command.payload.targetKingdomId,
          command.id,
        );
        break;
      case 'force_peace':
        this.accept(command, 'Force peace command accepted');
        this.forcePeace(command.payload.kingdomAId, command.payload.kingdomBId, command.id);
        break;
    }
  }

  private validateCommand(command: SimCommand) {
    switch (command.type) {
      case 'spawn_unit':
        if (!this.isInBounds(command.payload.position)) {
          return 'Spawn position is outside the world.';
        }

        if ((command.payload.count ?? 1) < 1 || (command.payload.count ?? 1) > MAX_SPAWN_COUNT) {
          return `Spawn count must be between 1 and ${MAX_SPAWN_COUNT}.`;
        }

        return undefined;
      case 'place_resource':
        if (!this.isInBounds(command.payload.position)) {
          return 'Resource position is outside the world.';
        }

        if (command.payload.amount < 1) {
          return 'Resource amount must be positive.';
        }

        return this.validateRadius(command.payload.radius);
      case 'change_terrain':
        if (!this.isInBounds(command.payload.position)) {
          return 'Terrain position is outside the world.';
        }

        return this.validateRadius(command.payload.radius);
      case 'lightning':
        if (!this.isInBounds(command.payload.position)) {
          return 'Lightning position is outside the world.';
        }

        if ((command.payload.damage ?? LIGHTNING_DAMAGE) <= 0) {
          return 'Lightning damage must be positive.';
        }

        return this.validateRadius(command.payload.radius);
      case 'set_speed':
      case 'pause':
        return undefined;
      case 'force_war':
        return this.validateKingdomPair(
          command.payload.aggressorKingdomId,
          command.payload.targetKingdomId,
        );
      case 'force_peace':
        return this.validateKingdomPair(command.payload.kingdomAId, command.payload.kingdomBId);
    }
  }

  private validateRadius(radius = 0) {
    if (radius < 0 || radius > MAX_COMMAND_RADIUS) {
      return `Command radius must be between 0 and ${MAX_COMMAND_RADIUS}.`;
    }

    return undefined;
  }

  private validateKingdomPair(leftId: string, rightId: string) {
    if (leftId === rightId) {
      return 'God diplomacy commands require two different kingdoms.';
    }

    const left = this.kingdoms.get(leftId);
    const right = this.kingdoms.get(rightId);

    if (!left || left.status === 'fallen' || !right || right.status === 'fallen') {
      return 'God diplomacy command kingdom is missing or fallen.';
    }

    return undefined;
  }

  private updateUnits(profile = false) {
    const timings = createEmptyUnitUpdateTimings();
    const units = [...this.units.values()];

    for (const unit of units) {
      const unitTimings = this.updateUnit(unit, profile);
      timings.updateUnitNeeds += unitTimings.updateUnitNeeds;
      timings.nearbyFoodLookup += unitTimings.nearbyFoodLookup;
      timings.nearestFoodLookup += unitTimings.nearestFoodLookup;
      timings.unitMovement += unitTimings.unitMovement;
      timings.reproduction += unitTimings.reproduction;
      timings.unitBehaviorCandidates += unitTimings.unitBehaviorCandidates;
      timings.unitBehaviorUpdates += unitTimings.unitBehaviorUpdates;
      timings.unitBehaviorSkipped += unitTimings.unitBehaviorSkipped;
    }

    timings.removeDeadUnits = this.measureStepPhase(profile, () => {
      for (const unit of units) {
        if (unit.intent === 'dead') {
          this.units.delete(unit.id);
        }
      }
    });

    return timings;
  }

  private updateUnit(unit: Unit, profile = false) {
    const timings = createEmptyUnitUpdateTimings();

    if ((unit as Unit).intent === 'dead') {
      return timings;
    }

    timings.updateUnitNeeds = this.measureStepPhase(profile, () => {
      unit.ageTicks += 1;
      unit.reproductionCooldownTicks = Math.max(0, unit.reproductionCooldownTicks - 1);
      unit.hunger = Math.min(MAX_HUNGER, unit.hunger + HUNGER_GAIN_PER_TICK);

      if (unit.ageTicks >= OLD_AGE_TICKS) {
        this.killUnit(unit, 'old age');
        return;
      }

      if (unit.hunger >= MAX_HUNGER) {
        unit.hp -= STARVATION_DAMAGE_PER_TICK;

        if (unit.hp <= 0) {
          this.killUnit(unit, 'starvation');
        }
      }
    });

    if (unit.intent === 'dead') {
      return timings;
    }

    timings.unitBehaviorCandidates = 1;

    if (!this.shouldUpdateUnitBehavior(unit)) {
      timings.unitBehaviorSkipped = 1;
      return timings;
    }

    timings.unitBehaviorUpdates = 1;

    if (unit.hunger > 35) {
      let foodTile: Tile | undefined;
      timings.nearbyFoodLookup = this.measureStepPhase(profile, () => {
        foodTile = this.findNearbyFood(unit.position);
      });

      const resource = foodTile?.resource;

      if (foodTile && resource) {
        unit.intent = 'eat';
        const eaten = Math.min(4, resource.amount);
        resource.amount -= eaten;
        unit.hunger = Math.max(0, unit.hunger - eaten * 10);
        this.emit('unit_ate', `${unit.id} ate food`, undefined, unit.id, unit.position, {
          amount: eaten,
        });

        if (resource.amount <= 0) {
          foodTile.resource = undefined;
        }
        return timings;
      }

      const village = unit.homeVillageId ? this.villages.get(unit.homeVillageId) : undefined;

      if (village && village.foodInventory > 0) {
        unit.intent = 'eat';
        const eaten = Math.min(4, village.foodInventory);
        village.foodInventory -= eaten;
        unit.hunger = Math.max(0, unit.hunger - eaten * 10);
        this.emit(
          'unit_ate',
          `${unit.id} ate from village stores`,
          undefined,
          unit.id,
          unit.position,
          {
            amount: eaten,
            source: 'village',
          },
        );
        return timings;
      }

      unit.intent = 'seek_food';
      let target: Position | undefined;
      timings.nearestFoodLookup = this.measureStepPhase(profile, () => {
        target = this.findNearestFoodPosition(unit.position);
      });
      timings.unitMovement = this.measureStepPhase(profile, () => {
        this.moveUnitToward(unit, target ?? this.randomNearbyPosition(unit.position));
      });
      return timings;
    }

    unit.intent = 'wander';
    timings.unitMovement = this.measureStepPhase(profile, () => {
      this.moveUnitToward(unit, this.randomNearbyPosition(unit.position));
    });
    timings.reproduction = this.measureStepPhase(profile, () => this.tryReproduce(unit));

    return timings;
  }

  private shouldUpdateUnitBehavior(unit: Unit) {
    if (!unit.homeVillageId) {
      return true;
    }

    if (unit.hunger > 35) {
      return true;
    }

    return (this.tick + (unit.behaviorPhase ?? 0)) % UNIT_BEHAVIOR_INTERVAL_TICKS === 0;
  }

  private tryReproduce(first: Unit) {
    if (
      first.ageTicks < ADULT_AGE_TICKS ||
      first.hunger > 35 ||
      first.reproductionCooldownTicks > 0 ||
      !this.rng.chance(BASE_BIRTH_CHANCE)
    ) {
      return;
    }

    const partner = this.findPartner(first);

    if (!partner) {
      return;
    }

    const village = this.getSharedVillage(first, partner);

    if (village && this.countVillagePopulation(village) >= village.housingCapacity) {
      return;
    }

    first.reproductionCooldownTicks = REPRODUCTION_COOLDOWN_TICKS;
    partner.reproductionCooldownTicks = REPRODUCTION_COOLDOWN_TICKS;

    const child = this.createUnit({
      race: first.race,
      gender: this.randomGender(),
      position: {
        x: (first.position.x + partner.position.x) / 2,
        y: (first.position.y + partner.position.y) / 2,
      },
      ageTicks: 0,
      hunger: 10,
      villageId: village?.id,
      homeVillageId: village?.id,
    });

    this.units.set(child.id, child);
    this.addVillageResident(child);
    this.emit('unit_born', `${child.id} was born`, undefined, child.id, child.position, {
      parentA: first.id,
      parentB: partner.id,
    });
  }

  private formVillages() {
    for (const unit of this.units.values()) {
      if (
        unit.intent === 'dead' ||
        unit.homeVillageId ||
        this.findVillageNear(unit.position, VILLAGE_RADIUS * 2)
      ) {
        continue;
      }

      const locals = this.findUnitsNear(unit.position, VILLAGE_RADIUS, unit.race).filter(
        (local) => !local.homeVillageId,
      );

      if (locals.length < VILLAGE_FOUNDING_POPULATION) {
        continue;
      }

      const center = averagePosition(locals.map((local) => local.position));

      if (
        this.findVillageNear(center, VILLAGE_RADIUS * 2) ||
        this.foodAmountNear(center, VILLAGE_FOOD_RADIUS) < VILLAGE_MIN_LOCAL_FOOD
      ) {
        continue;
      }

      const village: Village = {
        id: `village-${String(this.nextVillageId).padStart(4, '0')}`,
        name: createVillageName(unit.race, this.nextVillageId),
        level: 1,
        race: unit.race,
        center,
        population: locals.length,
        foodInventory: this.forageVillageFood(center, VILLAGE_INITIAL_FORAGE),
        foodCapacity: VILLAGE_BASE_FOOD_CAPACITY,
        woodInventory: 0,
        stoneInventory: 0,
        ironInventory: 0,
        jobs: createEmptyVillageJobs(),
        growthBlockers: [],
        primaryGrowthBlocker: undefined,
        buildPlan: 'idle',
        housingCapacity: Math.max(VILLAGE_BASE_HOUSING, locals.length + 4),
        territoryTiles: 0,
        foundedAtTick: this.tick,
        status: 'camp',
      };

      this.nextVillageId += 1;
      this.villages.set(village.id, village);
      const townHall = this.createBuilding(village, 'town_hall');
      this.buildings.set(townHall.id, townHall);

      for (const local of locals) {
        local.villageId = village.id;
        local.homeVillageId = village.id;
      }

      this.emit('village_founded', `${village.id} founded`, undefined, undefined, village.center, {
        race: village.race,
        population: village.population,
      });
    }
  }

  private updateVillages(profile = false) {
    const timings = createEmptyVillageUpdateTimings();

    timings.updateVillagePresence = this.measureStepPhase(profile, () => {
      for (const unit of this.units.values()) {
        unit.villageId = undefined;
      }
    });

    for (const village of [...this.villages.values()]) {
      let nearbyUnits: Unit[] = [];

      timings.updateVillagePresence += this.measureStepPhase(profile, () => {
        nearbyUnits = this.findUnitsNear(village.center, VILLAGE_RADIUS, village.race);

        for (const nearbyUnit of nearbyUnits) {
          if (!nearbyUnit.homeVillageId) {
            nearbyUnit.homeVillageId = village.id;
            this.addVillageResident(nearbyUnit);
          }
        }
      });

      const residents = this.findVillageResidents(village.id);
      village.population = residents.length;

      if (residents.length === 0) {
        this.villages.delete(village.id);
        this.abandonVillageBuildings(village.id);
        this.emit(
          'village_abandoned',
          `${village.id} abandoned`,
          undefined,
          undefined,
          village.center,
        );
        continue;
      }

      timings.updateVillagePresence += this.measureStepPhase(profile, () => {
        for (const member of nearbyUnits) {
          if (member.homeVillageId !== village.id) {
            continue;
          }

          member.villageId = village.id;
        }
      });

      timings.updateVillageEconomy += this.measureStepPhase(profile, () => {
        this.assignVillageJobs(village, residents);
        this.produceFarmFood(village);
        this.gatherVillageWood(village);
        this.produceMineResources(village);
        this.progressVillageConstruction(village);
        village.foodInventory += this.forageVillageFood(village.center, VILLAGE_FORAGE_PER_TICK);
        village.foodInventory = Math.min(village.foodInventory, village.foodCapacity);

        this.tryBuildForVillage(village);
        this.tryFoundSatelliteVillage(village, residents);
        this.updateVillageGrowthBlockers(village);
        this.updateVillageGrowthFeedback(village);
      });

      timings.updateVillageConsumption += this.measureStepPhase(profile, () => {
        if (
          this.tick <= village.foundedAtTick ||
          this.tick % VILLAGE_CONSUMPTION_INTERVAL_TICKS !== 0
        ) {
          return;
        }

        const requiredFood =
          village.population *
          (village.status === 'camp' ? VILLAGE_CAMP_FOOD_PER_RESIDENT : VILLAGE_FOOD_PER_RESIDENT);

        if (village.foodInventory >= requiredFood) {
          village.foodInventory -= requiredFood;
          village.status = 'stable';
          return;
        }

        if (village.status !== 'declining') {
          this.emit(
            'village_declining',
            `${village.id} is declining`,
            undefined,
            undefined,
            village.center,
          );
        }

        village.foodInventory = 0;
        village.status = 'declining';
      });
    }

    return timings;
  }

  private findUnitsNear(position: Position, radius: number, race?: UnitRace) {
    const units: Unit[] = [];

    for (const id of this.spatialIndex.nearbyUnitIds(position, radius)) {
      const unit = this.units.get(id);

      if (!unit) {
        continue;
      }

      if (unit.intent === 'dead' || (race && unit.race !== race)) {
        continue;
      }

      if (distance(position, unit.position) <= radius) {
        units.push(unit);
      }
    }

    return units;
  }

  private findVillageNear(position: Position, radius: number) {
    for (const village of this.villages.values()) {
      if (distance(position, village.center) <= radius) {
        return village;
      }
    }

    return undefined;
  }

  private foodAmountNear(position: Position, radius: number) {
    let amount = 0;

    forEachTileInRadius(this.map, position, radius, (tile) => {
      if (tile.resource?.type === 'food' && tile.resource.amount > 0) {
        amount += tile.resource.amount;
      }
    });

    return amount;
  }

  private forageVillageFood(position: Position, maxAmount: number) {
    let remaining = maxAmount;
    let gathered = 0;

    forEachTileInRadius(this.map, position, VILLAGE_FOOD_RADIUS, (tile) => {
      if (remaining <= 0 || tile.resource?.type !== 'food' || tile.resource.amount <= 0) {
        return;
      }

      const taken = Math.min(tile.resource.amount, remaining);
      tile.resource.amount -= taken;
      remaining -= taken;
      gathered += taken;

      if (tile.resource.amount <= 0) {
        tile.resource = undefined;
      }
    });

    return gathered;
  }

  private tryFoundSatelliteVillage(parent: Village, residents: Unit[]) {
    if (
      this.tick <= parent.foundedAtTick ||
      this.tick % VILLAGE_EXPANSION_INTERVAL_TICKS !== 0 ||
      parent.status === 'declining' ||
      !parent.kingdomId
    ) {
      return false;
    }

    if (
      residents.length < VILLAGE_EXPANSION_MIN_POPULATION ||
      parent.population < Math.floor(parent.housingCapacity * 0.7) ||
      parent.foodInventory < VILLAGE_EXPANSION_FOOD_COST ||
      parent.woodInventory < VILLAGE_EXPANSION_WOOD_COST ||
      this.findVillageOwnedBuildings(parent.id).length < 4
    ) {
      return false;
    }

    const site = this.findSatelliteVillageSite(parent);

    if (!site) {
      return false;
    }

    const settlers = [...residents]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(0, VILLAGE_EXPANSION_SETTLERS);

    if (settlers.length < VILLAGE_EXPANSION_SETTLERS) {
      return false;
    }

    parent.foodInventory -= VILLAGE_EXPANSION_FOOD_COST;
    parent.woodInventory -= VILLAGE_EXPANSION_WOOD_COST;

    const village: Village = {
      id: `village-${String(this.nextVillageId).padStart(4, '0')}`,
      name: createVillageName(parent.race, this.nextVillageId),
      level: 1,
      race: parent.race,
      kingdomId: parent.kingdomId,
      center: site,
      population: settlers.length,
      foodInventory:
        this.forageVillageFood(site, VILLAGE_INITIAL_FORAGE) +
        settlers.length * VILLAGE_CAMP_FOOD_PER_RESIDENT,
      foodCapacity: VILLAGE_BASE_FOOD_CAPACITY,
      woodInventory: 0,
      stoneInventory: 0,
      ironInventory: 0,
      jobs: createEmptyVillageJobs(),
      growthBlockers: [],
      primaryGrowthBlocker: undefined,
      buildPlan: 'idle',
      housingCapacity: Math.max(VILLAGE_BASE_HOUSING, settlers.length + 4),
      territoryTiles: 0,
      foundedAtTick: this.tick,
      status: 'camp',
    };

    this.nextVillageId += 1;
    this.villages.set(village.id, village);
    const townHall = this.createBuilding(village, 'town_hall');
    this.buildings.set(townHall.id, townHall);

    const settlerIds = new Set(settlers.map((settler) => settler.id));
    let index = 0;

    for (const settler of settlers) {
      settler.villageId = village.id;
      settler.homeVillageId = village.id;
      settler.position = {
        x: clamp(site.x + (index % 3) - 1, 0, this.map.width - 1),
        y: clamp(site.y + Math.floor(index / 3) - 1, 0, this.map.height - 1),
      };
      index += 1;
    }

    parent.population = Math.max(0, parent.population - settlers.length);
    this.villageResidents.set(
      parent.id,
      residents.filter((resident) => !settlerIds.has(resident.id)),
    );
    this.villageResidents.set(village.id, settlers);

    const kingdom = this.kingdoms.get(parent.kingdomId);

    if (kingdom && !kingdom.villageIds.includes(village.id)) {
      kingdom.villageIds.push(village.id);
      this.refreshKingdomMembership(kingdom);
    }

    const payload: Record<string, string | number | boolean> = {
      race: village.race,
      population: village.population,
      parentVillageId: parent.id,
    };

    if (village.kingdomId) {
      payload.kingdomId = village.kingdomId;
    }

    this.emit(
      'village_founded',
      `${village.id} founded from ${parent.id}`,
      undefined,
      undefined,
      site,
      payload,
    );

    return true;
  }

  private findSatelliteVillageSite(parent: Village): Position | undefined {
    let best: { position: Position; food: number; distance: number } | undefined;

    forEachTileInRadius(this.map, parent.center, VILLAGE_EXPANSION_MAX_RADIUS, (tile) => {
      if (!isWalkable(tile.terrain)) {
        return;
      }

      const candidate = { x: tile.x, y: tile.y };
      const candidateDistance = distance(parent.center, candidate);

      if (
        candidateDistance < VILLAGE_EXPANSION_MIN_RADIUS ||
        this.findVillageNear(candidate, VILLAGE_RADIUS * 2)
      ) {
        return;
      }

      const food = this.foodAmountNear(candidate, VILLAGE_FOOD_RADIUS);

      if (food < VILLAGE_MIN_LOCAL_FOOD) {
        return;
      }

      if (
        !best ||
        food > best.food ||
        (food === best.food && candidateDistance < best.distance) ||
        (food === best.food &&
          candidateDistance === best.distance &&
          `${candidate.x}:${candidate.y}` < `${best.position.x}:${best.position.y}`)
      ) {
        best = { position: candidate, food, distance: candidateDistance };
      }
    });

    return best?.position;
  }

  private getSharedVillage(first: Unit, second: Unit) {
    if (!first.homeVillageId || first.homeVillageId !== second.homeVillageId) {
      return undefined;
    }

    return this.villages.get(first.homeVillageId);
  }

  private countVillagePopulation(village: Village) {
    return this.findVillageResidents(village.id).length;
  }

  private findVillageResidents(villageId: string) {
    return (this.villageResidents.get(villageId) ?? []).filter(
      (unit) =>
        this.units.has(unit.id) && unit.intent !== 'dead' && unit.homeVillageId === villageId,
    );
  }

  private rebuildVillageResidentsIndex() {
    this.villageResidents.clear();

    for (const unit of this.units.values()) {
      this.addVillageResident(unit);
    }
  }

  private addVillageResident(unit: Unit) {
    if (unit.intent === 'dead' || !unit.homeVillageId) {
      return;
    }

    const residents = this.villageResidents.get(unit.homeVillageId);

    if (residents) {
      residents.push(unit);
      return;
    }

    this.villageResidents.set(unit.homeVillageId, [unit]);
  }

  private assignVillageJobs(village: Village, residents: Unit[]) {
    let availableWorkers = residents.length;
    const farms = this.findVillageBuildings(village.id, 'farm').length;
    const mines = this.findVillageBuildings(village.id, 'mine').length;
    const barracks = this.findVillageBuildings(village.id, 'barrack').length;

    const farmers =
      residents.length > 0
        ? Math.min(
            availableWorkers,
            farms > 0 ? Math.max(1, farms, Math.ceil(residents.length * 0.3)) : 1,
          )
        : 0;
    availableWorkers -= farmers;

    const miners =
      mines > 0
        ? Math.min(availableWorkers, Math.max(mines, Math.ceil(residents.length * 0.12)))
        : 0;
    availableWorkers -= miners;

    const builders = Math.min(availableWorkers, Math.max(0, Math.ceil(residents.length * 0.12)));
    availableWorkers -= builders;

    const soldiers =
      barracks > 0
        ? Math.min(availableWorkers, Math.max(1, Math.floor(residents.length * 0.16)))
        : 0;

    village.jobs = {
      farmer: farmers,
      builder: builders,
      miner: miners,
      soldier: soldiers,
    };
  }

  private produceFarmFood(village: Village) {
    const farms = this.findVillageBuildings(village.id, 'farm').length;
    const farmerFood = village.jobs.farmer * BASE_FARMER_FOOD_PER_TICK;
    const farmFood = farms * FARM_FOOD_PER_TICK;

    if (farmerFood <= 0 && farmFood <= 0) {
      return;
    }

    village.foodInventory = Math.min(
      village.foodCapacity,
      village.foodInventory + farmerFood + farmFood,
    );
  }

  private gatherVillageWood(village: Village) {
    let activeBuilders = village.jobs.builder;

    while (activeBuilders > 0) {
      const deposit = this.findWoodResourceTile(village.center, VILLAGE_WOOD_SCOUT_RADIUS);

      if (!deposit?.resource || deposit.resource.amount <= 0) {
        return;
      }

      const gathered = Math.min(WOOD_PER_BUILDER_TICK, deposit.resource.amount);
      village.woodInventory += gathered;
      deposit.resource.amount -= gathered;
      this.recordWorkSite(village, 'wood_gathering', deposit, gathered);
      activeBuilders -= 1;

      if (deposit.resource.amount <= 0) {
        deposit.resource = undefined;
      }
    }
  }

  private progressVillageConstruction(village: Village) {
    let builderWork = village.jobs.builder * CONSTRUCTION_WORK_PER_BUILDER_TICK;

    if (builderWork <= 0) {
      return;
    }

    const constructionSites = this.findVillageConstructionSites(village.id).sort(
      (left, right) => left.builtAtTick - right.builtAtTick,
    );

    for (const building of constructionSites) {
      if (builderWork <= 0) {
        return;
      }

      const remaining =
        (building.constructionWorkRequired ?? BUILDING_WORK_REQUIRED[building.type]) -
        (building.constructionProgress ?? 0);
      const progress = Math.min(builderWork, remaining);

      building.constructionProgress = (building.constructionProgress ?? 0) + progress;
      this.recordWorkSite(village, 'construction', building.position, progress);
      builderWork -= progress;

      if (
        building.constructionProgress >=
        (building.constructionWorkRequired ?? BUILDING_WORK_REQUIRED[building.type])
      ) {
        this.completeBuilding(village, building);
      }
    }
  }

  private completeBuilding(village: Village, building: VillageBuilding) {
    building.status = 'active';
    building.builtAtTick = this.tick;
    building.constructionProgress = building.constructionWorkRequired;
    this.applyCompletedBuildingEffects(village, building.type);

    this.emit(
      'building_built',
      `${building.id} ${building.type} built`,
      undefined,
      undefined,
      building.position,
      {
        villageId: village.id,
        type: building.type,
      },
    );
  }

  private applyCompletedBuildingEffects(village: Village, type: VillageBuildingType) {
    switch (type) {
      case 'town_hall':
        break;
      case 'house':
        village.housingCapacity = Math.min(
          VILLAGE_MAX_HOUSING,
          village.housingCapacity + HOUSE_HOUSING_BONUS,
        );
        break;
      case 'storage':
        village.foodCapacity += STORAGE_FOOD_CAPACITY_BONUS;
        break;
      case 'farm':
        break;
      case 'mine':
        break;
      case 'barrack':
        break;
      case 'dock':
        break;
    }
  }

  private produceMineResources(village: Village) {
    const mines = this.findVillageBuildings(village.id, 'mine');
    let activeMiners = village.jobs.miner;

    for (const mine of mines) {
      if (activeMiners <= 0) {
        return;
      }

      const deposit = this.findMineResourceTile(mine.position);

      if (!deposit?.resource || deposit.resource.amount <= 0) {
        continue;
      }

      const gathered = Math.min(MINE_RESOURCE_PER_TICK, deposit.resource.amount);

      if (deposit.resource.type === 'stone') {
        village.stoneInventory += gathered;
      } else if (deposit.resource.type === 'iron') {
        village.ironInventory += gathered;
      } else {
        continue;
      }

      deposit.resource.amount -= gathered;

      if (deposit.resource.amount <= 0) {
        deposit.resource = undefined;
      }

      activeMiners -= 1;
    }
  }

  private findWoodResourceTile(position: Position, radius = VILLAGE_WOOD_RADIUS) {
    let nearest: Tile | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    forEachTileInRadius(this.map, position, radius, (tile) => {
      if (tile.resource?.type !== 'wood' || tile.resource.amount <= 0) {
        return;
      }

      const candidateDistance = distance(position, tile);

      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearest = tile;
      }
    });

    return nearest;
  }

  private findMineResourceTile(position: Position) {
    let nearest: Tile | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    forEachTileInRadius(this.map, position, 3, (tile) => {
      if (
        tile.resource?.amount &&
        (tile.resource.type === 'stone' || tile.resource.type === 'iron')
      ) {
        const candidateDistance = distance(position, tile);

        if (candidateDistance < nearestDistance) {
          nearestDistance = candidateDistance;
          nearest = tile;
        }
      }
    });

    return nearest;
  }

  private tryBuildForVillage(village: Village) {
    if (this.tick <= village.foundedAtTick || this.tick % BUILDING_INTERVAL_TICKS !== 0) {
      return;
    }

    if (this.tryUpgradeTownHall(village)) {
      return;
    }

    if (this.tryUpgradeHouse(village)) {
      return;
    }

    village.buildPlan = this.chooseVillageBuildPlan(village);
    const type = this.chooseNextBuilding(village);

    if (!type || !this.canPayBuildingCost(village, type)) {
      return;
    }

    this.payBuildingCost(village, type);
    const building = this.createBuilding(village, type, 'constructing');
    this.buildings.set(building.id, building);
    this.recordWorkSite(village, 'construction', building.position);
  }

  private updateVillageGrowthFeedback(village: Village) {
    const previousLevel = village.level;
    const nextLevel = computeVillageLevel(
      village.population,
      village.housingCapacity,
      this.highestTownHallTier(village.id),
      this.findVillageOwnedBuildings(village.id).length,
    );

    village.level = nextLevel;

    if (nextLevel > previousLevel) {
      this.emit(
        'village_leveled_up',
        `${village.id} reached level ${nextLevel}`,
        undefined,
        undefined,
        village.center,
        {
          villageId: village.id,
          previousLevel,
          level: nextLevel,
          name: village.name,
        },
      );
    }
  }

  private canPayBuildingCost(village: Village, type: VillageBuildingType) {
    return this.canPayResourceCost(village, BUILDING_COSTS[type]);
  }

  private canPayResourceCost(village: Village, cost: BuildingResourceCost) {
    return (
      village.foodInventory >= cost.food &&
      village.woodInventory >= cost.wood &&
      village.stoneInventory >= cost.stone &&
      village.ironInventory >= cost.iron
    );
  }

  private payResourceCost(village: Village, cost: BuildingResourceCost) {
    village.foodInventory -= cost.food;
    village.woodInventory -= cost.wood;
    village.stoneInventory -= cost.stone;
    village.ironInventory -= cost.iron;
  }

  private payBuildingCost(village: Village, type: VillageBuildingType) {
    this.payResourceCost(village, BUILDING_COSTS[type]);
  }

  private tryUpgradeTownHall(village: Village) {
    const townHall = this.findVillageBuildings(village.id, 'town_hall')[0];

    if (!townHall || (townHall.tier ?? 1) >= 3) {
      return false;
    }

    const nextTier = (townHall.tier ?? 1) + 1;
    const requirements = TOWN_HALL_UPGRADE_REQUIREMENTS[nextTier - 1];

    if (
      !requirements ||
      village.population < requirements.population ||
      this.findVillageBuildings(village.id).length < requirements.buildings ||
      village.foodInventory < requirements.food
    ) {
      return false;
    }

    const cost = TOWN_HALL_UPGRADE_COSTS[nextTier - 1];

    if (village.foodInventory < cost) {
      return false;
    }

    village.foodInventory -= cost;
    townHall.tier = nextTier;
    this.emit(
      'building_upgraded',
      `${townHall.id} upgraded to tier ${nextTier}`,
      undefined,
      undefined,
      townHall.position,
      {
        villageId: village.id,
        type: 'town_hall',
        tier: nextTier,
      },
    );

    return true;
  }

  private tryUpgradeHouse(village: Village) {
    const highestTownHallTier = this.highestTownHallTier(village.id);

    if (highestTownHallTier < 2) {
      return false;
    }

    const house = [...this.findVillageBuildings(village.id, 'house')]
      .sort(
        (left, right) =>
          (left.tier ?? 1) - (right.tier ?? 1) || left.builtAtTick - right.builtAtTick,
      )
      .find((building) => (building.tier ?? 1) < highestTownHallTier);

    if (!house) {
      return false;
    }

    const currentTier = house.tier ?? 1;
    const nextTier = currentTier + 1;

    if (nextTier > highestTownHallTier) {
      return false;
    }

    const cost = HOUSE_UPGRADE_COSTS[nextTier - 1];

    if (!cost || !this.canPayResourceCost(village, cost)) {
      return false;
    }

    this.payResourceCost(village, cost);
    house.tier = nextTier;
    village.housingCapacity = Math.min(
      VILLAGE_MAX_HOUSING,
      village.housingCapacity + HOUSE_HOUSING_BONUS,
    );
    this.emit(
      'building_upgraded',
      `${house.id} upgraded to tier ${nextTier}`,
      undefined,
      undefined,
      house.position,
      {
        villageId: village.id,
        type: 'house',
        tier: nextTier,
      },
    );

    return true;
  }

  private chooseNextBuilding(village: Village): VillageBuildingType | undefined {
    return this.buildTypeForPlan(village, this.chooseVillageBuildPlan(village));
  }

  private chooseVillageBuildPlan(village: Village): VillageBuildPlan {
    const buildings = this.findVillageOwnedBuildings(village.id);
    const houses = buildings.filter((building) => building.type === 'house').length;
    const storage = buildings.filter((building) => building.type === 'storage').length;
    const farms = buildings.filter((building) => building.type === 'farm').length;
    const mines = buildings.filter((building) => building.type === 'mine').length;
    const barracks = buildings.filter((building) => building.type === 'barrack').length;
    const docks = buildings.filter((building) => building.type === 'dock').length;
    const hasHousingPressure = this.hasHousingPressure(village);

    if (houses === 0) {
      return 'expand_housing';
    }

    if (storage === 0) {
      return 'expand_storage';
    }

    if (hasHousingPressure) {
      return 'expand_housing';
    }

    if (farms === 0) {
      return 'expand_farms';
    }

    if (mines === 0) {
      const mineSite = this.findMineSite(village);
      const shallowQuarrySite =
        village.stoneInventory < BUILDING_COSTS.barrack.stone
          ? this.findShallowQuarrySite(village)
          : undefined;

      if (mineSite || shallowQuarrySite) {
        return 'expand_mining';
      }
    }

    if (farms < 2) {
      return 'expand_farms';
    }

    if (barracks === 0 && village.population >= ARMY_MIN_SOLDIERS) {
      return 'expand_military';
    }

    if (docks === 0 && this.findDockSite(village)) {
      return 'expand_dock';
    }

    if (hasHousingPressure) {
      return 'expand_housing';
    }

    const prosperityPlan = this.chooseProsperityBuildPlan(village, {
      houses,
      storage,
      farms,
    });

    if (prosperityPlan) {
      return prosperityPlan;
    }

    const expansionPlan = this.chooseExpansionBuildPlan(village, buildings.length);

    if (expansionPlan) {
      return expansionPlan;
    }

    if (!this.hasProsperityForConstruction(village)) {
      return 'waiting_resources';
    }

    if (village.population < Math.floor(village.housingCapacity * HOUSING_PRESSURE_RATIO)) {
      return 'waiting_population_pressure';
    }

    return 'idle';
  }

  private chooseExpansionBuildPlan(
    village: Village,
    buildingCount: number,
  ): VillageBuildPlan | undefined {
    if (village.status === 'declining' || !village.kingdomId || buildingCount < 4) {
      return undefined;
    }

    const buildings = this.findVillageOwnedBuildings(village.id);
    const hasBasicChain =
      buildings.some((building) => building.type === 'house') &&
      buildings.some((building) => building.type === 'storage') &&
      buildings.some((building) => building.type === 'farm');

    if (!hasBasicChain) {
      return undefined;
    }

    if (
      village.population < VILLAGE_EXPANSION_MIN_POPULATION ||
      village.population < Math.floor(village.housingCapacity * 0.7)
    ) {
      return 'waiting_population_pressure';
    }

    if (
      village.foodInventory < VILLAGE_EXPANSION_FOOD_COST ||
      village.woodInventory < VILLAGE_EXPANSION_WOOD_COST
    ) {
      return 'waiting_resources';
    }

    if (!this.findSatelliteVillageSite(village)) {
      return 'waiting_land';
    }

    return 'prepare_expansion';
  }

  private chooseProsperityBuildPlan(
    village: Village,
    counts: { houses: number; storage: number; farms: number },
  ): VillageBuildPlan | undefined {
    if (!this.hasProsperityForConstruction(village)) {
      return undefined;
    }

    if (
      village.housingCapacity < VILLAGE_MAX_HOUSING &&
      counts.houses < this.targetHouseCount(village)
    ) {
      return 'expand_housing';
    }

    if (counts.farms < this.targetFarmCount(village)) {
      return 'expand_farms';
    }

    if (counts.storage < this.targetStorageCount(village)) {
      return 'expand_storage';
    }

    return undefined;
  }

  private buildTypeForPlan(
    village: Village,
    plan: VillageBuildPlan,
  ): VillageBuildingType | undefined {
    switch (plan) {
      case 'expand_housing':
        return village.housingCapacity < VILLAGE_MAX_HOUSING ? 'house' : undefined;
      case 'expand_farms':
        return 'farm';
      case 'expand_storage':
        return 'storage';
      case 'expand_mining':
        return 'mine';
      case 'expand_military':
        return 'barrack';
      case 'expand_dock':
        return 'dock';
      case 'prepare_expansion':
      case 'waiting_population_pressure':
      case 'waiting_resources':
      case 'waiting_land':
      case 'idle':
        return undefined;
    }
  }

  private updateVillageGrowthBlockers(village: Village) {
    const blockers: VillageGrowthBlocker[] = [];
    village.buildPlan = this.chooseVillageBuildPlan(village);
    const desiredBuilding = this.buildTypeForPlan(village, village.buildPlan);
    const desiredCost = desiredBuilding ? BUILDING_COSTS[desiredBuilding] : undefined;
    const hasConstruction = this.findVillageConstructionSites(village.id).length > 0;

    if (this.hasHousingPressure(village)) {
      blockers.push('housing_pressure');
    }

    if (desiredCost && village.woodInventory < desiredCost.wood) {
      blockers.push('missing_wood');

      if (!this.findWoodResourceTile(village.center, VILLAGE_WOOD_SCOUT_RADIUS)) {
        blockers.push('no_wood_source');
      }
    }

    if ((desiredBuilding || hasConstruction) && village.jobs.builder <= 0) {
      blockers.push('insufficient_builders');
    }

    if (village.foodInventory < village.population * VILLAGE_FOOD_PER_RESIDENT) {
      blockers.push('low_food_reserve');
    }

    if (desiredBuilding && !this.hasBuildableLandFor(village, desiredBuilding)) {
      blockers.push('no_buildable_land');
    }

    if (village.buildPlan === 'waiting_resources') {
      if (village.foodInventory < VILLAGE_EXPANSION_FOOD_COST) {
        blockers.push('low_food_reserve');
      }

      if (village.woodInventory < VILLAGE_EXPANSION_WOOD_COST) {
        blockers.push('missing_wood');

        if (!this.findWoodResourceTile(village.center, VILLAGE_WOOD_SCOUT_RADIUS)) {
          blockers.push('no_wood_source');
        }
      }
    }

    if (village.buildPlan === 'waiting_land') {
      blockers.push('no_buildable_land');
    }

    village.growthBlockers = uniqueBlockers(blockers);
    village.primaryGrowthBlocker = selectPrimaryGrowthBlocker(village.growthBlockers);
  }

  private hasHousingPressure(village: Village) {
    return (
      village.housingCapacity < VILLAGE_MAX_HOUSING &&
      village.population >=
        Math.min(village.housingCapacity - 2, village.housingCapacity * HOUSING_PRESSURE_RATIO)
    );
  }

  private hasProsperityForConstruction(village: Village) {
    return (
      village.status === 'stable' &&
      village.population >= PROSPERITY_BUILD_MIN_POPULATION &&
      village.woodInventory >= PROSPERITY_BUILD_MIN_WOOD &&
      village.foodInventory >= village.foodCapacity * PROSPERITY_BUILD_FOOD_FILL_RATIO
    );
  }

  private targetHouseCount(village: Village) {
    return Math.min(10, Math.max(1, Math.ceil(village.population / HOUSE_HOUSING_BONUS) + 1));
  }

  private targetFarmCount(village: Village) {
    return Math.min(5, Math.max(1, Math.ceil(village.population / 14)));
  }

  private targetStorageCount(village: Village) {
    return Math.min(4, Math.max(1, Math.ceil(village.population / 24)));
  }

  private hasBuildableLandFor(village: Village, type: VillageBuildingType) {
    if (type === 'mine') {
      return Boolean(this.findMineSite(village) || this.findShallowQuarrySite(village));
    }

    if (type === 'dock') {
      return Boolean(this.findDockSite(village));
    }

    return this.hasWalkableTileNear(village.center, 4);
  }

  private createBuilding(
    village: Village,
    type: VillageBuildingType,
    status: VillageBuilding['status'] = 'active',
  ): VillageBuilding {
    const buildingCount = this.findVillageOwnedBuildings(village.id).length;
    const angle = buildingCount * 2.399963229728653;
    const radius = 2 + (buildingCount % 4);
    const position =
      type === 'town_hall'
        ? village.center
        : type === 'mine'
          ? (this.findMineSite(village) ??
            this.createShallowQuarrySite(village) ??
            this.findBuildablePosition(village.center))
          : type === 'dock'
            ? (this.findDockSite(village) ?? this.findBuildablePosition(village.center))
            : this.findBuildablePosition({
                x: village.center.x + Math.cos(angle) * radius,
                y: village.center.y + Math.sin(angle) * radius,
              });

    const building: VillageBuilding = {
      id: `building-${String(this.nextBuildingId).padStart(5, '0')}`,
      villageId: village.id,
      type,
      status: 'active',
      position,
      builtAtTick: this.tick,
      tier: type === 'town_hall' || type === 'house' ? 1 : undefined,
    };

    if (status === 'constructing') {
      building.status = 'constructing';
      building.constructionProgress = 0;
      building.constructionWorkRequired = BUILDING_WORK_REQUIRED[type];
    }

    this.nextBuildingId += 1;
    return building;
  }

  private findMineSite(village: Village): Position | undefined {
    let nearestDeposit: Position | undefined;
    let nearestDepositDistance = Number.POSITIVE_INFINITY;
    let nearestHill: Position | undefined;
    let nearestHillDistance = Number.POSITIVE_INFINITY;

    forEachTileInRadius(this.map, village.center, MINE_SITE_RADIUS, (tile) => {
      if (!isWalkable(tile.terrain) || !this.isMineSite(tile)) {
        return;
      }

      const candidateDistance = distance(village.center, tile);

      if (tile.resource?.type === 'stone' || tile.resource?.type === 'iron') {
        if (candidateDistance < nearestDepositDistance) {
          nearestDepositDistance = candidateDistance;
          nearestDeposit = { x: tile.x, y: tile.y };
        }
        return;
      }

      if (candidateDistance < nearestHillDistance) {
        nearestHillDistance = candidateDistance;
        nearestHill = { x: tile.x, y: tile.y };
      }
    });

    return nearestDeposit ?? nearestHill;
  }

  private findShallowQuarrySite(village: Village): Tile | undefined {
    let nearest: Tile | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    forEachTileInRadius(this.map, village.center, VILLAGE_SHALLOW_QUARRY_RADIUS, (tile) => {
      if (!isWalkable(tile.terrain) || tile.resource) {
        return;
      }

      const candidateDistance = distance(village.center, tile);

      if (candidateDistance < 2 || candidateDistance >= nearestDistance) {
        return;
      }

      nearestDistance = candidateDistance;
      nearest = tile;
    });

    return nearest;
  }

  private createShallowQuarrySite(village: Village): Position | undefined {
    const tile = this.findShallowQuarrySite(village);

    if (!tile) {
      return undefined;
    }

    tile.terrain = 'hill';
    tile.biome = 'highland';
    tile.resource = {
      type: 'stone',
      amount: VILLAGE_SHALLOW_QUARRY_AMOUNT,
    };

    return { x: tile.x, y: tile.y };
  }

  private isMineSite(tile: Tile) {
    return (
      tile.terrain === 'hill' || tile.resource?.type === 'stone' || tile.resource?.type === 'iron'
    );
  }

  private findDockSite(village: Village): Position | undefined {
    let nearest: Position | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    forEachTileInRadius(this.map, village.center, DOCK_SITE_RADIUS, (tile) => {
      if (!this.isDockSite(tile)) {
        return;
      }

      const candidateDistance = distance(village.center, tile);

      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearest = { x: tile.x, y: tile.y };
      }
    });

    return nearest;
  }

  private isDockSite(tile: Tile) {
    if (!isWalkable(tile.terrain)) {
      return false;
    }

    return [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ].some((position) => getTile(this.map, position)?.terrain === 'water');
  }

  private findBuildablePosition(position: Position) {
    const clamped = {
      x: clamp(position.x, 0, this.map.width - 1),
      y: clamp(position.y, 0, this.map.height - 1),
    };
    const tile = getTile(this.map, clamped);

    if (tile && isWalkable(tile.terrain)) {
      return clamped;
    }

    for (let radius = 1; radius <= 4; radius += 1) {
      let found: Position | undefined;

      forEachTileInRadius(this.map, clamped, radius, (candidate) => {
        if (!found && isWalkable(candidate.terrain)) {
          found = { x: candidate.x, y: candidate.y };
        }
      });

      if (found) {
        return found;
      }
    }

    return clamped;
  }

  private hasWalkableTileNear(position: Position, radius: number) {
    let found = false;

    forEachTileInRadius(this.map, position, radius, (tile) => {
      if (!found && isWalkable(tile.terrain)) {
        found = true;
      }
    });

    return found;
  }

  private recordWorkSite(
    village: Village,
    type: VillageWorkSite['type'],
    position: Position,
    amount = 0,
  ) {
    const key = `${village.id}:${type}:${Math.floor(position.x)}:${Math.floor(position.y)}`;
    const existing = this.workSites.get(key);

    this.workSites.set(key, {
      id: key,
      type,
      villageId: village.id,
      position: {
        x: round(position.x),
        y: round(position.y),
      },
      amount: round((existing?.amount ?? 0) + amount),
      expiresAtTick: this.tick + WORK_SITE_VISIBLE_TICKS,
    });
  }

  private pruneWorkSites() {
    for (const [id, site] of this.workSites.entries()) {
      if (site.expiresAtTick < this.tick || !this.villages.has(site.villageId)) {
        this.workSites.delete(id);
      }
    }
  }

  private findVillageBuildings(villageId: string, type?: VillageBuildingType) {
    return [...this.buildings.values()].filter(
      (building) =>
        building.status === 'active' &&
        building.villageId === villageId &&
        (!type || building.type === type),
    );
  }

  private findVillageConstructionSites(villageId: string) {
    return [...this.buildings.values()].filter(
      (building) => building.status === 'constructing' && building.villageId === villageId,
    );
  }

  private findVillageOwnedBuildings(villageId: string, type?: VillageBuildingType) {
    return [...this.buildings.values()].filter(
      (building) =>
        (building.status === 'active' || building.status === 'constructing') &&
        building.villageId === villageId &&
        (!type || building.type === type),
    );
  }

  private abandonVillageBuildings(villageId: string) {
    for (const building of this.buildings.values()) {
      if (
        building.villageId === villageId &&
        (building.status === 'active' || building.status === 'constructing')
      ) {
        building.status = 'abandoned';
        building.abandonedAtTick = this.tick;
      }
    }
  }

  private updateBuildingDecay() {
    for (const building of this.buildings.values()) {
      if (building.status !== 'abandoned') {
        continue;
      }

      const abandonedAtTick = building.abandonedAtTick ?? this.tick;
      building.abandonedAtTick = abandonedAtTick;

      if (this.tick - abandonedAtTick < BUILDING_RUIN_TICKS) {
        continue;
      }

      building.status = 'ruined';
      building.ruinedAtTick = this.tick;
      this.emit(
        'building_ruined',
        `${building.id} ruined after abandonment`,
        undefined,
        undefined,
        building.position,
        {
          buildingId: building.id,
          villageId: building.villageId,
          type: building.type,
          tier: building.tier ?? 1,
          abandonedAtTick,
          ruinedAtTick: this.tick,
        },
      );
    }
  }

  private projectTerritory() {
    const claims = new Map<string, { villageId: string; kingdomId?: string }>();

    for (const village of this.villages.values()) {
      this.claimTerritory(claims, village, village.center, this.settlementTerritoryRadius(village));
    }

    for (const building of this.buildings.values()) {
      if (building.status !== 'active' || !this.villages.has(building.villageId)) {
        continue;
      }

      const village = this.villages.get(building.villageId);

      if (!village) {
        continue;
      }

      this.claimTerritory(claims, village, building.position, BUILDING_TERRITORY_RADIUS);
    }

    for (const site of this.workSites.values()) {
      if (site.expiresAtTick < this.tick) {
        continue;
      }

      const village = this.villages.get(site.villageId);

      if (!village) {
        continue;
      }

      this.claimTerritory(claims, village, site.position, WORK_SITE_TERRITORY_RADIUS);
    }

    return [...claims.entries()].map(([key, claim]) => {
      const [x, y] = key.split(':').map(Number);
      return { x, y, villageId: claim.villageId, kingdomId: claim.kingdomId };
    });
  }

  private settlementTerritoryRadius(village: Village) {
    return Math.min(
      SETTLEMENT_TERRITORY_MAX_RADIUS,
      SETTLEMENT_TERRITORY_BASE_RADIUS +
        village.level +
        Math.floor(Math.max(village.population, village.housingCapacity) / 16),
    );
  }

  private claimTerritory(
    claims: Map<string, { villageId: string; kingdomId?: string }>,
    village: Village,
    center: Position,
    radius: number,
  ) {
    forEachTileInRadius(this.map, center, radius, (tile) => {
      if (!isWalkable(tile.terrain)) {
        return;
      }

      claims.set(`${tile.x}:${tile.y}`, {
        villageId: village.id,
        kingdomId: village.kingdomId,
      });
    });
  }

  private countTerritoryByVillage(territory: Array<{ villageId: string }>) {
    const counts = new Map<string, number>();

    for (const tile of territory) {
      counts.set(tile.villageId, (counts.get(tile.villageId) ?? 0) + 1);
    }

    return counts;
  }

  private updateKingdoms() {
    for (const village of this.villages.values()) {
      if (village.kingdomId && !this.kingdoms.has(village.kingdomId)) {
        village.kingdomId = undefined;
      }
    }

    for (const kingdom of this.kingdoms.values()) {
      this.refreshKingdomMembership(kingdom);
    }

    for (const village of this.villages.values()) {
      if (village.kingdomId || !this.isKingdomEligibleVillage(village)) {
        continue;
      }

      const kingdom = this.findJoinableKingdom(village);

      if (kingdom) {
        this.addVillageToKingdom(village, kingdom);
        continue;
      }

      this.foundKingdom(village);
    }

    for (const kingdom of this.kingdoms.values()) {
      this.refreshKingdomMembership(kingdom);
    }
  }

  private refreshKingdomMembership(kingdom: Kingdom) {
    const villages = kingdom.villageIds
      .map((id) => this.villages.get(id))
      .filter(
        (village): village is Village => village !== undefined && village.kingdomId === kingdom.id,
      );

    kingdom.villageIds = villages.map((village) => village.id);

    if (villages.length === 0) {
      if (kingdom.status !== 'fallen') {
        kingdom.status = 'fallen';
        kingdom.population = 0;
        kingdom.buildingCount = 0;
        kingdom.territoryTiles = 0;
        kingdom.foodInventory = 0;
        kingdom.woodInventory = 0;
        kingdom.stoneInventory = 0;
        kingdom.ironInventory = 0;
        kingdom.diplomacyPressure = 0;
        kingdom.diplomacyTargetKingdomId = undefined;
        this.emit('kingdom_fallen', `${kingdom.id} fallen`);
      }

      return;
    }

    const capital = this.villages.get(kingdom.capitalVillageId);

    if (!capital || !kingdom.villageIds.includes(capital.id) || capital.kingdomId !== kingdom.id) {
      const nextCapital = this.chooseReplacementCapital(villages);
      kingdom.capitalVillageId = nextCapital.id;
      this.emit(
        'kingdom_capital_changed',
        `${kingdom.id} capital moved`,
        undefined,
        undefined,
        nextCapital.center,
        { villageId: nextCapital.id },
      );
    }

    kingdom.status = villages.some((village) => village.status === 'declining')
      ? 'declining'
      : kingdom.status === 'fallen'
        ? 'rising'
        : kingdom.status;

    for (const village of villages) {
      village.kingdomId = kingdom.id;
    }

    this.updateKingdomSummary(kingdom, villages);
  }

  private chooseReplacementCapital(villages: Village[]) {
    return [...villages].sort((left, right) => {
      const townHallTierDelta =
        this.highestTownHallTier(right.id) - this.highestTownHallTier(left.id);

      if (townHallTierDelta !== 0) {
        return townHallTierDelta;
      }

      const buildingCountDelta =
        this.findVillageBuildings(right.id).length - this.findVillageBuildings(left.id).length;

      if (buildingCountDelta !== 0) {
        return buildingCountDelta;
      }

      const populationDelta = right.population - left.population;

      if (populationDelta !== 0) {
        return populationDelta;
      }

      return left.id.localeCompare(right.id);
    })[0];
  }

  private highestTownHallTier(villageId: string) {
    return this.findVillageBuildings(villageId, 'town_hall').reduce(
      (highest, building) => Math.max(highest, building.tier ?? 0),
      0,
    );
  }

  private isKingdomEligibleVillage(village: Village) {
    return (
      village.population >= KINGDOM_FOUNDING_POPULATION &&
      this.findVillageBuildings(village.id).length >= KINGDOM_FOUNDING_BUILDINGS
    );
  }

  private findJoinableKingdom(village: Village) {
    let closest: Kingdom | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const kingdom of this.kingdoms.values()) {
      if (kingdom.status === 'fallen' || kingdom.race !== village.race) {
        continue;
      }

      const distanceToKingdom = this.distanceToKingdom(village, kingdom);

      if (distanceToKingdom <= KINGDOM_JOIN_RADIUS && distanceToKingdom < closestDistance) {
        closest = kingdom;
        closestDistance = distanceToKingdom;
      }
    }

    return closest;
  }

  private distanceToKingdom(village: Village, kingdom: Kingdom) {
    let nearest = Number.POSITIVE_INFINITY;

    for (const villageId of kingdom.villageIds) {
      const member = this.villages.get(villageId);

      if (!member) {
        continue;
      }

      nearest = Math.min(nearest, distance(village.center, member.center));
    }

    return nearest;
  }

  private foundKingdom(village: Village) {
    const kingdom: Kingdom = {
      id: `kingdom-${String(this.nextKingdomId).padStart(4, '0')}`,
      race: village.race,
      color: KINGDOM_COLORS[(this.nextKingdomId - 1) % KINGDOM_COLORS.length],
      capitalVillageId: village.id,
      villageIds: [village.id],
      population: 0,
      buildingCount: 0,
      territoryTiles: 0,
      foodInventory: 0,
      woodInventory: 0,
      stoneInventory: 0,
      ironInventory: 0,
      diplomacyPressure: 0,
      diplomacyTargetKingdomId: undefined,
      foundedAtTick: this.tick,
      status: 'rising',
    };

    this.nextKingdomId += 1;
    this.kingdoms.set(kingdom.id, kingdom);
    village.kingdomId = kingdom.id;
    this.updateKingdomSummary(kingdom, [village]);
    this.emit('kingdom_founded', `${kingdom.id} founded`, undefined, undefined, village.center, {
      villageId: village.id,
      race: village.race,
    });
  }

  private addVillageToKingdom(village: Village, kingdom: Kingdom) {
    if (!kingdom.villageIds.includes(village.id)) {
      kingdom.villageIds.push(village.id);
    }

    village.kingdomId = kingdom.id;
    this.refreshKingdomMembership(kingdom);
    this.emit(
      'kingdom_joined',
      `${village.id} joined kingdom ${kingdom.id}`,
      undefined,
      undefined,
      village.center,
      {
        kingdomId: kingdom.id,
        villageId: village.id,
      },
    );
  }

  private updateKingdomSummary(kingdom: Kingdom, villages: Village[]) {
    const territoryByVillage = this.countTerritoryByVillage(this.projectTerritory());
    kingdom.population = villages.reduce((total, village) => total + village.population, 0);
    kingdom.buildingCount = villages.reduce(
      (total, village) => total + this.findVillageBuildings(village.id).length,
      0,
    );
    kingdom.territoryTiles = villages.reduce(
      (total, village) => total + (territoryByVillage.get(village.id) ?? 0),
      0,
    );
    kingdom.foodInventory = villages.reduce((total, village) => total + village.foodInventory, 0);
    kingdom.woodInventory = villages.reduce((total, village) => total + village.woodInventory, 0);
    kingdom.stoneInventory = villages.reduce((total, village) => total + village.stoneInventory, 0);
    kingdom.ironInventory = villages.reduce((total, village) => total + village.ironInventory, 0);
  }

  private updateDiplomacy() {
    const activeKingdoms = [...this.kingdoms.values()].filter(
      (kingdom) => kingdom.status !== 'fallen',
    );
    const activeKingdomIds = new Set(activeKingdoms.map((kingdom) => kingdom.id));

    this.pruneDiplomacyRelations(activeKingdomIds);

    for (const kingdom of activeKingdoms) {
      kingdom.diplomacyPressure = 0;
      kingdom.diplomacyTargetKingdomId = undefined;
    }

    for (let leftIndex = 0; leftIndex < activeKingdoms.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < activeKingdoms.length; rightIndex += 1) {
        const left = activeKingdoms[leftIndex];
        const right = activeKingdoms[rightIndex];
        const relation = this.getDiplomacyRelation(left.id, right.id);
        const distanceToBorder = this.distanceBetweenKingdoms(left, right);

        if (relation.truceUntilTick !== undefined && this.tick < relation.truceUntilTick) {
          relation.pressure = 0;
          relation.warDeclared = false;
          relation.armyFormed = false;
          this.recordDiplomacySummary(left, right, relation.pressure);
          continue;
        }

        if (!Number.isFinite(distanceToBorder) || distanceToBorder > DIPLOMACY_INTERACTION_RANGE) {
          relation.pressure = Math.max(0, relation.pressure - DIPLOMACY_DECAY_PER_TICK);
          this.recordDiplomacySummary(left, right, relation.pressure);
          continue;
        }

        const borderPressure = this.borderFrictionPressure(distanceToBorder);
        const resourcePressure = this.resourcePressure(left, right);
        const raceModifier = this.diplomacyRaceModifier(left.race, right.race);
        const pressureDelta = (borderPressure + resourcePressure) * raceModifier;

        relation.pressure = Math.max(
          0,
          relation.pressure + pressureDelta - DIPLOMACY_DECAY_PER_TICK,
        );

        this.reportDiplomacyCauses(
          relation,
          left,
          right,
          borderPressure,
          resourcePressure,
          distanceToBorder,
        );
        this.reportDiplomacyPressure(
          relation,
          left,
          right,
          borderPressure,
          resourcePressure,
          raceModifier,
        );
        if (relation.warDeclared) {
          this.ensureWarArmy(relation, left, right);
        } else {
          this.tryDeclareWar(relation, left, right, borderPressure, resourcePressure, raceModifier);
        }
        this.recordDiplomacySummary(left, right, relation.pressure);
      }
    }
  }

  private pruneDiplomacyRelations(activeKingdomIds: Set<string>) {
    for (const key of this.diplomacy.keys()) {
      const [leftId, rightId] = key.split('|');

      if (!activeKingdomIds.has(leftId) || !activeKingdomIds.has(rightId)) {
        this.diplomacy.delete(key);
      }
    }
  }

  private getDiplomacyRelation(leftId: string, rightId: string) {
    const key = this.diplomacyKey(leftId, rightId);
    let relation = this.diplomacy.get(key);

    if (!relation) {
      relation = {
        pressure: 0,
        warDeclared: false,
        armyFormed: false,
        pressureReportTier: -1,
        borderReportTier: -1,
        resourceReportTier: -1,
      };
      this.diplomacy.set(key, relation);
    }

    return relation;
  }

  private diplomacyKey(leftId: string, rightId: string) {
    return leftId < rightId ? `${leftId}|${rightId}` : `${rightId}|${leftId}`;
  }

  private recordDiplomacySummary(left: Kingdom, right: Kingdom, pressure: number) {
    if (pressure > left.diplomacyPressure) {
      left.diplomacyPressure = pressure;
      left.diplomacyTargetKingdomId = right.id;
    }

    if (pressure > right.diplomacyPressure) {
      right.diplomacyPressure = pressure;
      right.diplomacyTargetKingdomId = left.id;
    }
  }

  private borderFrictionPressure(distanceToBorder: number) {
    if (distanceToBorder > DIPLOMACY_BORDER_RANGE) {
      return 0;
    }

    return (DIPLOMACY_BORDER_RANGE - distanceToBorder) * DIPLOMACY_BORDER_PRESSURE_PER_TILE;
  }

  private resourcePressure(left: Kingdom, right: Kingdom) {
    return (
      Math.max(this.kingdomFoodDeficit(left), this.kingdomFoodDeficit(right)) *
      DIPLOMACY_RESOURCE_PRESSURE_PER_FOOD
    );
  }

  private kingdomFoodDeficit(kingdom: Kingdom) {
    return Math.max(0, DIPLOMACY_FOOD_TARGET_PER_RESIDENT - this.foodPerResident(kingdom));
  }

  private foodPerResident(kingdom: Kingdom) {
    return kingdom.population > 0 ? kingdom.foodInventory / kingdom.population : 0;
  }

  private diplomacyRaceModifier(left: UnitRace, right: UnitRace) {
    if (left === right) {
      return 0.45;
    }

    return (this.raceAggression(left) + this.raceAggression(right)) / 2;
  }

  private raceAggression(race: UnitRace) {
    switch (race) {
      case 'orc':
        return 1.35;
      case 'dwarf':
        return 1.1;
      case 'elf':
        return 0.8;
      case 'human':
        return 1;
    }
  }

  private distanceBetweenKingdoms(left: Kingdom, right: Kingdom) {
    let nearest = Number.POSITIVE_INFINITY;

    for (const leftVillageId of left.villageIds) {
      const leftVillage = this.villages.get(leftVillageId);

      if (!leftVillage) {
        continue;
      }

      for (const rightVillageId of right.villageIds) {
        const rightVillage = this.villages.get(rightVillageId);

        if (!rightVillage) {
          continue;
        }

        nearest = Math.min(nearest, distance(leftVillage.center, rightVillage.center));
      }
    }

    return nearest;
  }

  private reportDiplomacyCauses(
    relation: KingdomDiplomacyRelation,
    left: Kingdom,
    right: Kingdom,
    borderPressure: number,
    resourcePressure: number,
    distanceToBorder: number,
  ) {
    const borderTier = Math.floor(borderPressure / DIPLOMACY_CAUSE_REPORT_STEP);

    if (borderPressure > 0 && borderTier > relation.borderReportTier) {
      relation.borderReportTier = borderTier;
      this.emit(
        'border_friction',
        `${left.id} and ${right.id} border friction`,
        undefined,
        undefined,
        undefined,
        {
          kingdomAId: left.id,
          kingdomBId: right.id,
          distance: round(distanceToBorder),
          pressure: round(borderPressure),
        },
      );
    }

    const resourceTier = Math.floor(resourcePressure / DIPLOMACY_CAUSE_REPORT_STEP);

    if (resourcePressure > 0 && resourceTier > relation.resourceReportTier) {
      relation.resourceReportTier = resourceTier;
      this.emit(
        'resource_pressure',
        `${left.id} and ${right.id} resource pressure`,
        undefined,
        undefined,
        undefined,
        {
          kingdomAId: left.id,
          kingdomBId: right.id,
          pressure: round(resourcePressure),
          leftFoodPerResident: round(this.foodPerResident(left)),
          rightFoodPerResident: round(this.foodPerResident(right)),
        },
      );
    }
  }

  private reportDiplomacyPressure(
    relation: KingdomDiplomacyRelation,
    left: Kingdom,
    right: Kingdom,
    borderPressure: number,
    resourcePressure: number,
    raceModifier: number,
  ) {
    const pressureTier = Math.floor(relation.pressure / DIPLOMACY_PRESSURE_REPORT_STEP);

    if (relation.pressure <= 0 || pressureTier <= relation.pressureReportTier) {
      return;
    }

    relation.pressureReportTier = pressureTier;
    this.emit(
      'diplomacy_pressure',
      `${left.id} and ${right.id} tension rising`,
      undefined,
      undefined,
      undefined,
      {
        kingdomAId: left.id,
        kingdomBId: right.id,
        pressure: round(relation.pressure),
        borderPressure: round(borderPressure),
        resourcePressure: round(resourcePressure),
        raceModifier: round(raceModifier),
      },
    );
  }

  private tryDeclareWar(
    relation: KingdomDiplomacyRelation,
    left: Kingdom,
    right: Kingdom,
    borderPressure: number,
    resourcePressure: number,
    raceModifier: number,
  ) {
    if (relation.warDeclared || relation.pressure < DIPLOMACY_WAR_DECLARATION_PRESSURE) {
      return;
    }

    relation.warDeclared = true;
    const aggressor = this.chooseWarDeclarer(left, right);
    const target = aggressor.id === left.id ? right : left;
    relation.aggressorKingdomId = aggressor.id;
    relation.targetKingdomId = target.id;

    this.emit(
      'war_declared',
      `${aggressor.id} declared war on ${target.id}`,
      undefined,
      undefined,
      this.villages.get(aggressor.capitalVillageId)?.center,
      {
        aggressorKingdomId: aggressor.id,
        targetKingdomId: target.id,
        pressure: round(relation.pressure),
        borderPressure: round(borderPressure),
        resourcePressure: round(resourcePressure),
        raceModifier: round(raceModifier),
      },
    );
    this.formArmyGroup(aggressor, target, relation);
  }

  private forceWar(aggressorKingdomId: string, targetKingdomId: string, commandId: string) {
    const aggressor = this.kingdoms.get(aggressorKingdomId);
    const target = this.kingdoms.get(targetKingdomId);

    if (!aggressor || !target) {
      return;
    }

    const relation = this.getDiplomacyRelation(aggressor.id, target.id);
    relation.pressure = Math.max(relation.pressure, DIPLOMACY_WAR_DECLARATION_PRESSURE);
    relation.warDeclared = true;
    relation.armyFormed = false;
    relation.aggressorKingdomId = aggressor.id;
    relation.targetKingdomId = target.id;
    relation.nextArmyReadyTick = undefined;
    relation.truceUntilTick = undefined;

    this.emit(
      'war_declared',
      `${aggressor.id} forced war on ${target.id}`,
      commandId,
      undefined,
      this.villages.get(aggressor.capitalVillageId)?.center,
      {
        aggressorKingdomId: aggressor.id,
        targetKingdomId: target.id,
        pressure: round(relation.pressure),
        forced: true,
      },
    );
    this.formArmyGroup(aggressor, target, relation);
  }

  private forcePeace(kingdomAId: string, kingdomBId: string, commandId: string) {
    const left = this.kingdoms.get(kingdomAId);
    const right = this.kingdoms.get(kingdomBId);

    if (!left || !right) {
      return;
    }

    for (const army of this.armies.values()) {
      const belongsToPair =
        (army.kingdomId === left.id && army.targetKingdomId === right.id) ||
        (army.kingdomId === right.id && army.targetKingdomId === left.id);

      if (belongsToPair && army.status !== 'disbanded') {
        this.disbandArmy(army, 'forced peace');
      }
    }

    const relation = this.getDiplomacyRelation(left.id, right.id);
    relation.pressure = 0;
    relation.warDeclared = false;
    relation.armyFormed = false;
    relation.aggressorKingdomId = undefined;
    relation.targetKingdomId = undefined;
    relation.nextArmyReadyTick = undefined;
    relation.truceUntilTick = this.tick + FORCED_PEACE_TRUCE_TICKS;
    relation.pressureReportTier = -1;
    relation.borderReportTier = -1;
    relation.resourceReportTier = -1;
    left.diplomacyPressure = 0;
    left.diplomacyTargetKingdomId = undefined;
    right.diplomacyPressure = 0;
    right.diplomacyTargetKingdomId = undefined;

    this.emit(
      'peace_forced',
      `${left.id} and ${right.id} forced peace`,
      commandId,
      undefined,
      undefined,
      {
        kingdomAId: left.id,
        kingdomBId: right.id,
      },
    );
  }

  private ensureWarArmy(relation: KingdomDiplomacyRelation, left: Kingdom, right: Kingdom) {
    const aggressor =
      relation.aggressorKingdomId === right.id
        ? right
        : relation.aggressorKingdomId === left.id
          ? left
          : this.chooseWarDeclarer(left, right);
    const target =
      relation.targetKingdomId === left.id
        ? left
        : relation.targetKingdomId === right.id
          ? right
          : aggressor.id === left.id
            ? right
            : left;

    this.formArmyGroup(aggressor, target, relation);
  }

  private chooseWarDeclarer(left: Kingdom, right: Kingdom) {
    const leftScore = this.raceAggression(left.race) + this.kingdomFoodDeficit(left) / 4;
    const rightScore = this.raceAggression(right.race) + this.kingdomFoodDeficit(right) / 4;

    return leftScore >= rightScore ? left : right;
  }

  private formArmyGroup(aggressor: Kingdom, target: Kingdom, relation: KingdomDiplomacyRelation) {
    const currentAggressor = this.kingdoms.get(aggressor.id) ?? aggressor;
    const currentTarget = this.kingdoms.get(target.id) ?? target;

    if (relation.nextArmyReadyTick !== undefined && this.tick < relation.nextArmyReadyTick) {
      return;
    }

    const activeArmyCount = this.countActiveArmiesAgainst(currentAggressor.id, currentTarget.id);
    let remainingSlots = Math.max(0, ARMY_GROUPS_PER_WAR - activeArmyCount);

    if (remainingSlots <= 0) {
      return;
    }

    let formedAny = false;
    const originVillages = this.eligibleArmyOriginVillages(currentAggressor, currentTarget);

    for (const originVillage of originVillages) {
      if (remainingSlots <= 0) {
        break;
      }

      if (this.hasActiveArmyFromOrigin(originVillage.id, currentTarget.id)) {
        continue;
      }

      const targetVillage = this.findArmyTargetVillage(originVillage, currentTarget);

      if (!targetVillage) {
        continue;
      }

      this.createArmyGroup(currentAggressor, currentTarget, originVillage, targetVillage, relation);
      formedAny = true;
      remainingSlots -= 1;
    }

    if (formedAny) {
      relation.armyFormed = true;
      relation.aggressorKingdomId = currentAggressor.id;
      relation.targetKingdomId = currentTarget.id;
      relation.nextArmyReadyTick = undefined;
    }
  }

  private eligibleArmyOriginVillages(aggressor: Kingdom, target: Kingdom) {
    return aggressor.villageIds
      .map((villageId) => this.villages.get(villageId))
      .filter((village): village is Village => {
        if (
          !village ||
          village.kingdomId !== aggressor.id ||
          village.population < ARMY_MIN_SOLDIERS
        ) {
          return false;
        }

        return this.findArmyTargetVillage(village, target) !== undefined;
      })
      .sort((left, right) => {
        if (left.id === aggressor.capitalVillageId) {
          return -1;
        }

        if (right.id === aggressor.capitalVillageId) {
          return 1;
        }

        return right.population - left.population || left.id.localeCompare(right.id);
      });
  }

  private findArmyTargetVillage(originVillage: Village, target: Kingdom) {
    let nearest: Village | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const targetVillageId of target.villageIds) {
      const targetVillage = this.villages.get(targetVillageId);

      if (!targetVillage || targetVillage.kingdomId !== target.id) {
        continue;
      }

      const targetDistance = distance(originVillage.center, targetVillage.center);

      if (
        targetDistance < nearestDistance ||
        (targetDistance === nearestDistance && targetVillage.id < (nearest?.id ?? ''))
      ) {
        nearest = targetVillage;
        nearestDistance = targetDistance;
      }
    }

    return nearest;
  }

  private createArmyGroup(
    aggressor: Kingdom,
    target: Kingdom,
    originVillage: Village,
    targetVillage: Village,
    relation: KingdomDiplomacyRelation,
  ) {
    const barracks = this.findVillageBuildings(originVillage.id, 'barrack').length;
    const trainedSoldiers = originVillage.jobs.soldier;
    const mobilizationRatio =
      ARMY_MOBILIZATION_RATIO +
      barracks * BARRACK_MOBILIZATION_RATIO_BONUS +
      Math.min(0.18, trainedSoldiers * SOLDIER_JOB_MOBILIZATION_BONUS);
    const maxSoldiers =
      (barracks > 0 ? ARMY_BARRACK_MAX_SOLDIERS : ARMY_MAX_SOLDIERS) +
      Math.min(8, trainedSoldiers * SOLDIER_JOB_CAP_BONUS);
    const soldierCount = Math.min(
      maxSoldiers,
      Math.max(ARMY_MIN_SOLDIERS, Math.floor(originVillage.population * mobilizationRatio)),
    );
    const army: ArmyGroup = {
      id: `army-${String(this.nextArmyId).padStart(5, '0')}`,
      kingdomId: aggressor.id,
      targetKingdomId: target.id,
      originVillageId: originVillage.id,
      targetVillageId: targetVillage.id,
      position: { ...originVillage.center },
      soldierCount,
      trainedSoldiers,
      morale: 1,
      formedAtTick: this.tick,
      status: 'marching',
    };

    this.nextArmyId += 1;
    this.armies.set(army.id, army);
    this.emit('army_formed', `${army.id} formed`, undefined, undefined, army.position, {
      kingdomId: army.kingdomId,
      targetKingdomId: army.targetKingdomId,
      soldiers: army.soldierCount,
      trainedSoldiers: army.trainedSoldiers,
      originVillageId: army.originVillageId,
      targetVillageId: army.targetVillageId,
    });
  }

  private countActiveArmiesAgainst(kingdomId: string, targetKingdomId: string) {
    let count = 0;

    for (const army of this.armies.values()) {
      if (
        army.status !== 'disbanded' &&
        army.kingdomId === kingdomId &&
        army.targetKingdomId === targetKingdomId
      ) {
        count += 1;
      }
    }

    return count;
  }

  private hasActiveArmyFromOrigin(originVillageId: string, targetKingdomId: string) {
    for (const army of this.armies.values()) {
      if (
        army.status !== 'disbanded' &&
        army.originVillageId === originVillageId &&
        army.targetKingdomId === targetKingdomId
      ) {
        return true;
      }
    }

    return false;
  }

  private updateArmies() {
    for (const army of [...this.armies.values()]) {
      if (army.status === 'disbanded') {
        continue;
      }

      const kingdom = this.kingdoms.get(army.kingdomId);
      const targetKingdom = this.kingdoms.get(army.targetKingdomId);
      const targetVillage = this.villages.get(army.targetVillageId);

      if (
        !kingdom ||
        kingdom.status === 'fallen' ||
        !targetKingdom ||
        targetKingdom.status === 'fallen' ||
        !targetVillage ||
        targetVillage.kingdomId !== army.targetKingdomId ||
        army.soldierCount <= 0
      ) {
        this.disbandArmy(army, 'lost target');
        continue;
      }

      this.moveArmyToward(army, targetVillage.center);

      if (distance(army.position, targetVillage.center) <= ARMY_BATTLE_DISTANCE) {
        this.updateArmyBattle(army, targetVillage);
      }
    }
  }

  private moveArmyToward(army: ArmyGroup, target: Position) {
    army.status = 'marching';
    const dx = target.x - army.position.x;
    const dy = target.y - army.position.y;
    const length = Math.max(1, Math.hypot(dx, dy));

    army.position = {
      x: clamp(army.position.x + (dx / length) * ARMY_SPEED_PER_TICK, 0, this.map.width - 1),
      y: clamp(army.position.y + (dy / length) * ARMY_SPEED_PER_TICK, 0, this.map.height - 1),
    };
  }

  private updateArmyBattle(army: ArmyGroup, targetVillage: Village) {
    const attacker = this.kingdoms.get(army.kingdomId);
    const defender = this.kingdoms.get(army.targetKingdomId);

    if (!attacker || !defender) {
      this.disbandArmy(army, 'missing kingdom');
      return;
    }

    army.status = 'fighting';
    army.battleStartedAtTick ??= this.tick;
    army.occupationProgress ??= 0;
    const defenderBuildings = this.findVillageBuildings(targetVillage.id).length;
    const attackerStrength =
      army.soldierCount * army.morale * this.raceAggression(attacker.race) +
      army.trainedSoldiers * 0.35;
    const defenderStrength =
      targetVillage.population * DEFENDER_POPULATION_STRENGTH +
      defenderBuildings * DEFENDER_BUILDING_STRENGTH;
    const pressureRatio = attackerStrength / Math.max(1, defenderStrength);

    if (pressureRatio < 0.45 && army.occupationProgress <= 0) {
      this.resolveArmyBattle(army, targetVillage, attacker, defender, 0, 0, false);
      army.status = 'retreating';
      this.disbandArmy(army, 'repelled');
      return;
    }

    army.occupationProgress = clamp(
      army.occupationProgress + ARMY_OCCUPATION_PROGRESS_PER_TICK * clamp(pressureRatio, 0.45, 1.8),
      0,
      100,
    );

    if (
      army.lastBattleTick === undefined ||
      this.tick - army.lastBattleTick >= ARMY_BATTLE_CASUALTY_INTERVAL_TICKS ||
      army.occupationProgress >= 100
    ) {
      const attackerCasualties = Math.min(
        army.soldierCount,
        Math.max(1, Math.floor(defenderStrength / 12)),
      );
      const defenderCasualties = Math.min(
        targetVillage.population,
        Math.max(1, Math.floor(attackerStrength / 7)),
      );

      army.lastBattleTick = this.tick;
      army.soldierCount -= attackerCasualties;
      army.battleAttackerCasualties = (army.battleAttackerCasualties ?? 0) + attackerCasualties;
      army.battleDefenderCasualties = (army.battleDefenderCasualties ?? 0) + defenderCasualties;
      this.removeCasualtiesFromVillage(army.originVillageId, attackerCasualties, 'battle');
      this.removeCasualtiesFromVillage(targetVillage.id, defenderCasualties, 'battle');

      if (army.soldierCount <= 0) {
        this.resolveArmyBattle(
          army,
          targetVillage,
          attacker,
          defender,
          army.battleAttackerCasualties ?? 0,
          army.battleDefenderCasualties ?? 0,
          false,
        );
        army.status = 'retreating';
        this.disbandArmy(army, 'destroyed');
        return;
      }
    }

    if (army.occupationProgress < 100) {
      return;
    }

    const captured = army.soldierCount > 0;

    this.resolveArmyBattle(
      army,
      targetVillage,
      attacker,
      defender,
      army.battleAttackerCasualties ?? 0,
      army.battleDefenderCasualties ?? 0,
      captured,
    );

    if (!captured) {
      army.status = 'retreating';
      this.disbandArmy(army, 'repelled');
    }
  }

  private resolveArmyBattle(
    army: ArmyGroup,
    targetVillage: Village,
    attacker: Kingdom,
    defender: Kingdom,
    attackerCasualties: number,
    defenderCasualties: number,
    captured: boolean,
  ) {
    this.emit(
      'battle_resolved',
      `${army.id} battle resolved`,
      undefined,
      undefined,
      targetVillage.center,
      {
        attackerKingdomId: attacker.id,
        defenderKingdomId: defender.id,
        targetVillageId: targetVillage.id,
        attackerCasualties,
        defenderCasualties,
        captured,
        trainedSoldiers: army.trainedSoldiers,
        occupationProgress: round(army.occupationProgress ?? 0),
      },
    );

    if (captured) {
      this.captureVillage(targetVillage, attacker, defender);
      this.disbandArmy(army, 'captured target');
      return;
    }
  }

  private removeCasualtiesFromVillage(villageId: string, count: number, reason: string) {
    const casualties = this.findVillageResidents(villageId).slice(0, count);

    for (const unit of casualties) {
      this.killUnit(unit, reason);
      this.units.delete(unit.id);
    }
  }

  private captureVillage(village: Village, attacker: Kingdom, defender: Kingdom) {
    defender.villageIds = defender.villageIds.filter((villageId) => villageId !== village.id);
    village.kingdomId = attacker.id;

    if (!attacker.villageIds.includes(village.id)) {
      attacker.villageIds.push(village.id);
    }

    this.refreshKingdomMembership(attacker);
    this.refreshKingdomMembership(defender);
    this.emit('village_captured', `${village.id} captured`, undefined, undefined, village.center, {
      villageId: village.id,
      attackerKingdomId: attacker.id,
      defenderKingdomId: defender.id,
    });
  }

  private disbandArmy(army: ArmyGroup, reason: string) {
    if (army.status === 'disbanded') {
      return;
    }

    army.status = 'disbanded';
    const relation = this.diplomacy.get(this.diplomacyKey(army.kingdomId, army.targetKingdomId));

    if (relation) {
      relation.armyFormed = false;
      relation.nextArmyReadyTick = this.tick + ARMY_REFORM_COOLDOWN_TICKS;
    }

    this.emit('army_disbanded', `${army.id} disbanded`, undefined, undefined, army.position, {
      armyId: army.id,
      kingdomId: army.kingdomId,
      reason,
    });
  }

  private findPartner(first: Unit) {
    const nearbyIds = this.spatialIndex.nearbyUnitIds(first.position, REPRODUCTION_RADIUS);

    for (const id of nearbyIds) {
      const candidate = this.units.get(id);

      if (!candidate || candidate.id === first.id || candidate.intent === 'dead') {
        continue;
      }

      if (
        candidate.race === first.race &&
        candidate.gender !== first.gender &&
        candidate.ageTicks >= ADULT_AGE_TICKS &&
        candidate.hunger <= 35 &&
        candidate.reproductionCooldownTicks <= 0 &&
        distance(first.position, candidate.position) <= REPRODUCTION_RADIUS
      ) {
        return candidate;
      }
    }

    return undefined;
  }

  private findNearbyFood(position: Position) {
    let found = getTile(this.map, position);

    if (found?.resource?.type === 'food' && found.resource.amount > 0) {
      return found;
    }

    forEachTileInRadius(this.map, position, 1.5, (tile) => {
      if (found?.resource?.type === 'food' && found.resource.amount > 0) {
        return;
      }

      if (tile.resource?.type === 'food' && tile.resource.amount > 0) {
        found = tile;
      }
    });

    return found?.resource?.type === 'food' && found.resource.amount > 0 ? found : undefined;
  }

  private findNearestFoodPosition(position: Position) {
    let nearest: Position | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;

    forEachTileInRadius(this.map, position, SEEK_FOOD_RADIUS, (tile) => {
      if (tile.resource?.type !== 'food' || tile.resource.amount <= 0) {
        return;
      }

      const candidateDistance = distance(position, tile);

      if (candidateDistance < nearestDistance) {
        nearestDistance = candidateDistance;
        nearest = { x: tile.x, y: tile.y };
      }
    });

    return nearest;
  }

  private moveUnitToward(unit: Unit, target: Position) {
    const dx = target.x - unit.position.x;
    const dy = target.y - unit.position.y;
    const length = Math.max(1, Math.hypot(dx, dy));
    const next = {
      x: unit.position.x + dx / length,
      y: unit.position.y + dy / length,
    };
    const tile = getTile(this.map, next);

    if (!tile || !isWalkable(tile.terrain)) {
      return;
    }

    unit.position = {
      x: clamp(next.x, 0, this.map.width - 1),
      y: clamp(next.y, 0, this.map.height - 1),
    };
  }

  private randomNearbyPosition(position: Position) {
    return {
      x: clamp(position.x + this.rng.int(3) - 1, 0, this.map.width - 1),
      y: clamp(position.y + this.rng.int(3) - 1, 0, this.map.height - 1),
    };
  }

  private spawnInitialUnits(count: number) {
    const center = { x: this.map.width / 2, y: this.map.height / 2 };
    this.spawnUnits(center, 'human', count);
  }

  private spawnUnits(position: Position, race: UnitRace, count: number, gender?: UnitGender) {
    for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
      const unit = this.createUnit({
        race,
        gender: gender ?? this.randomGender(),
        position: this.randomNearbyPosition(position),
        ageTicks: ADULT_AGE_TICKS + this.rng.int(240),
        hunger: 10 + this.rng.int(20),
        reproductionCooldownTicks: STARTING_REPRODUCTION_COOLDOWN_TICKS + this.rng.int(240),
      });

      this.units.set(unit.id, unit);
      this.emit('unit_spawned', `${unit.id} spawned`, undefined, unit.id, unit.position, { race });
    }
  }

  private createUnit(options: {
    race: UnitRace;
    gender: UnitGender;
    position: Position;
    ageTicks: number;
    hunger: number;
    reproductionCooldownTicks?: number;
    villageId?: string;
    homeVillageId?: string;
  }): Unit {
    const unit: Unit = {
      id: `unit-${String(this.nextUnitId).padStart(5, '0')}`,
      race: options.race,
      gender: options.gender,
      position: {
        x: clamp(options.position.x, 0, this.map.width - 1),
        y: clamp(options.position.y, 0, this.map.height - 1),
      },
      hp: MAX_HP,
      hunger: options.hunger,
      ageTicks: options.ageTicks,
      reproductionCooldownTicks:
        options.reproductionCooldownTicks ?? this.rng.int(REPRODUCTION_COOLDOWN_TICKS),
      behaviorPhase: this.nextUnitId % UNIT_BEHAVIOR_INTERVAL_TICKS,
      intent: 'idle',
      villageId: options.villageId,
      homeVillageId: options.homeVillageId,
    };

    this.nextUnitId += 1;
    return unit;
  }

  private placeResource(
    position: Position,
    resourceType: ResourceType,
    amount: number,
    radius: number,
    commandId: string,
  ) {
    forEachTileInRadius(this.map, position, radius, (tile) => {
      if (!isWalkable(tile.terrain)) {
        return;
      }

      tile.resource = {
        type: resourceType,
        amount: Math.max(1, Math.floor(amount)),
      };
    });
    this.emit('resource_placed', `${resourceType} placed`, commandId, undefined, position, {
      amount,
    });
  }

  private changeTerrain(
    position: Position,
    terrain: TerrainType,
    radius: number,
    commandId: string,
  ) {
    let changedTerrain = false;

    forEachTileInRadius(this.map, position, radius, (tile) => {
      changedTerrain ||= tile.terrain !== terrain;
      tile.terrain = terrain;
      tile.biome =
        terrain === 'forest'
          ? 'woodland'
          : terrain === 'hill'
            ? 'highland'
            : terrain === 'water'
              ? 'coast'
              : terrain === 'sand'
                ? 'dryland'
                : terrain === 'snow'
                  ? 'frozen'
                  : terrain === 'lava'
                    ? 'volcanic'
                    : 'temperate';

      if (!isWalkable(terrain)) {
        tile.resource = undefined;
      }
    });

    if (changedTerrain) {
      this.terrainRevision += 1;
    }

    this.emit('terrain_changed', `Terrain changed to ${terrain}`, commandId, undefined, position, {
      terrain,
    });
  }

  private strikeLightning(position: Position, radius: number, damage: number, commandId: string) {
    for (const unit of this.units.values()) {
      if (distance(position, unit.position) > radius) {
        continue;
      }

      unit.hp -= damage;

      if (unit.hp <= 0) {
        this.killUnit(unit, 'lightning');
      }
    }

    this.emit('lightning_struck', 'Lightning struck', commandId, undefined, position, {
      radius,
      damage,
    });
  }

  private killUnit(unit: Unit, reason: string) {
    unit.intent = 'dead';
    unit.hp = 0;
    this.emit('unit_died', `${unit.id} died from ${reason}`, undefined, unit.id, unit.position);
  }

  private accept(command: SimCommand, message: string) {
    this.emit('command_accepted', message, command.id, undefined, undefined, {
      issuedAtTick: command.issuedAtTick,
    });
  }

  private reject(command: SimCommand, reason: string) {
    this.emit('command_rejected', reason, command.id, undefined, undefined, {
      commandType: command.type,
      issuedAtTick: command.issuedAtTick,
    });
  }

  private emit(
    type: SimEvent['type'],
    message: string,
    sourceCommandId?: string,
    unitId?: string,
    position?: Position,
    payload?: Record<string, string | number | boolean>,
  ) {
    this.events.push({
      id: `event-${String(this.nextEventId).padStart(6, '0')}`,
      tick: this.tick,
      type,
      message,
      sourceCommandId,
      unitId,
      position: position ? { ...position } : undefined,
      payload,
    });
    this.nextEventId += 1;
  }

  private randomGender(): UnitGender {
    return this.rng.chance(0.5) ? 'female' : 'male';
  }

  private isInBounds(position: Position) {
    return (
      position.x >= 0 &&
      position.y >= 0 &&
      position.x < this.map.width &&
      position.y < this.map.height
    );
  }
}

function cloneUnit(unit: Unit): Unit {
  return {
    ...unit,
    position: { ...unit.position },
  };
}

function cloneVillage(village: Village, territoryTiles: number): Village {
  return {
    ...village,
    level: village.level,
    center: {
      x: round(village.center.x),
      y: round(village.center.y),
    },
    foodInventory: round(village.foodInventory),
    woodInventory: round(village.woodInventory),
    stoneInventory: round(village.stoneInventory),
    ironInventory: round(village.ironInventory),
    jobs: { ...village.jobs },
    growthBlockers: [...village.growthBlockers],
    primaryGrowthBlocker: village.primaryGrowthBlocker,
    buildPlan: village.buildPlan,
    territoryTiles,
  };
}

function cloneBuilding(building: VillageBuilding): VillageBuilding {
  return {
    ...building,
    position: {
      x: round(building.position.x),
      y: round(building.position.y),
    },
  };
}

function cloneKingdom(kingdom: Kingdom): Kingdom {
  return {
    ...kingdom,
    villageIds: [...kingdom.villageIds],
    foodInventory: round(kingdom.foodInventory),
    woodInventory: round(kingdom.woodInventory),
    stoneInventory: round(kingdom.stoneInventory),
    ironInventory: round(kingdom.ironInventory),
    diplomacyPressure: round(kingdom.diplomacyPressure),
  };
}

function cloneArmy(army: ArmyGroup): ArmyGroup {
  return {
    ...army,
    position: {
      x: round(army.position.x),
      y: round(army.position.y),
    },
    morale: round(army.morale),
  };
}

function cloneWorkSite(site: VillageWorkSite): VillageWorkSite {
  return {
    ...site,
    position: {
      x: round(site.position.x),
      y: round(site.position.y),
    },
    amount: site.amount === undefined ? undefined : round(site.amount),
  };
}

function viewportToTileBounds(
  viewport: WorldProjectionViewport,
  mapWidth: number,
  mapHeight: number,
): TileBounds {
  const padding = viewport.paddingTiles ?? 0;
  const minX = clamp(Math.floor(viewport.x - padding), 0, mapWidth - 1);
  const minY = clamp(Math.floor(viewport.y - padding), 0, mapHeight - 1);
  const maxX = clamp(Math.ceil(viewport.x + viewport.width + padding) - 1, minX, mapWidth - 1);
  const maxY = clamp(Math.ceil(viewport.y + viewport.height + padding) - 1, minY, mapHeight - 1);

  return { minX, minY, maxX, maxY };
}

function normalizeViewport(viewport: WorldProjectionViewport): WorldProjectionViewport {
  return {
    x: round(viewport.x),
    y: round(viewport.y),
    width: round(viewport.width),
    height: round(viewport.height),
    paddingTiles: viewport.paddingTiles,
  };
}

function isTileInBounds(tile: Pick<Position, 'x' | 'y'>, bounds: TileBounds) {
  return (
    tile.x >= bounds.minX && tile.x <= bounds.maxX && tile.y >= bounds.minY && tile.y <= bounds.maxY
  );
}

function isPositionInBounds(position: Position, bounds: TileBounds) {
  return (
    position.x >= bounds.minX &&
    position.x <= bounds.maxX + 1 &&
    position.y >= bounds.minY &&
    position.y <= bounds.maxY + 1
  );
}

function uniqueBlockers(blockers: VillageGrowthBlocker[]) {
  return [...new Set(blockers)];
}

function selectPrimaryGrowthBlocker(blockers: VillageGrowthBlocker[]) {
  const priority: VillageGrowthBlocker[] = [
    'no_wood_source',
    'missing_wood',
    'insufficient_builders',
    'no_buildable_land',
    'low_food_reserve',
    'housing_pressure',
  ];

  return priority.find((blocker) => blockers.includes(blocker));
}

function averagePosition(positions: Position[]) {
  const total = positions.reduce(
    (sum, position) => ({
      x: sum.x + position.x,
      y: sum.y + position.y,
    }),
    { x: 0, y: 0 },
  );

  return {
    x: total.x / positions.length,
    y: total.y / positions.length,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createEmptyStepPhaseTimings(): SimStepPhaseTimings {
  return {
    commandDrain: 0,
    spatialIndexRebuildBeforeVillages: 0,
    formVillages: 0,
    rebuildVillageResidentsIndex: 0,
    updateUnits: 0,
    updateUnitNeeds: 0,
    nearbyFoodLookup: 0,
    nearestFoodLookup: 0,
    unitMovement: 0,
    reproduction: 0,
    removeDeadUnits: 0,
    unitBehaviorCandidates: 0,
    unitBehaviorUpdates: 0,
    unitBehaviorSkipped: 0,
    spatialIndexRebuildBeforeVillagesUpdate: 0,
    updateVillages: 0,
    updateVillagePresence: 0,
    updateVillageResidents: 0,
    updateVillageEconomy: 0,
    updateVillageConsumption: 0,
    updateKingdoms: 0,
    updateDiplomacy: 0,
    updateArmies: 0,
    spatialIndexRebuildAfterArmies: 0,
    total: 0,
  };
}

function createEmptyVillageUpdateTimings() {
  return {
    updateVillagePresence: 0,
    updateVillageResidents: 0,
    updateVillageEconomy: 0,
    updateVillageConsumption: 0,
  };
}

function createEmptyVillageJobs(): VillageJobs {
  return {
    farmer: 0,
    builder: 0,
    miner: 0,
    soldier: 0,
  };
}

function createVillageName(race: UnitRace, villageId: number) {
  const pool = VILLAGE_NAME_POOLS[race];
  const baseName = pool[(villageId - 1) % pool.length];

  return `${baseName}村`;
}

function computeVillageLevel(
  population: number,
  housingCapacity: number,
  townHallTier: number,
  buildingCount: number,
) {
  const populationBand = Math.floor(Math.max(0, population - 1) / 10);
  const housingBand = Math.floor(Math.max(0, housingCapacity - VILLAGE_BASE_HOUSING) / 8);
  const townHallBand = Math.max(0, townHallTier - 1);
  const buildingBand = Math.floor(Math.max(0, buildingCount - 1) / 3);

  return Math.max(1, Math.min(5, 1 + populationBand + housingBand + townHallBand + buildingBand));
}

function createEmptyUnitUpdateTimings() {
  return {
    updateUnitNeeds: 0,
    nearbyFoodLookup: 0,
    nearestFoodLookup: 0,
    unitMovement: 0,
    reproduction: 0,
    removeDeadUnits: 0,
    unitBehaviorCandidates: 0,
    unitBehaviorUpdates: 0,
    unitBehaviorSkipped: 0,
  };
}

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
