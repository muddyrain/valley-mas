import { createWorldMap, forEachTileInRadius, getTile, isWalkable, resourceTotals } from './map';
import { SeededRng } from './rng';
import { SpatialIndex } from './spatialIndex';
import type {
  ArmyGroup,
  Kingdom,
  Position,
  ResourceType,
  SimCommand,
  SimEvent,
  SimWorldOptions,
  TerrainType,
  Unit,
  UnitGender,
  UnitRace,
  Village,
  VillageBuilding,
  VillageBuildingType,
  WorldProjection,
} from './types';

const MAX_HP = 100;
const MAX_HUNGER = 100;
const HUNGER_GAIN_PER_TICK = 0.7;
const STARVATION_DAMAGE_PER_TICK = 1.4;
const OLD_AGE_TICKS = 60 * 240;
const ADULT_AGE_TICKS = 12 * 240;
const REPRODUCTION_COOLDOWN_TICKS = 240 * 3;
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
const VILLAGE_MIN_LOCAL_FOOD = 30;
const VILLAGE_INITIAL_FORAGE = 24;
const VILLAGE_FORAGE_PER_TICK = 3;
const VILLAGE_CONSUMPTION_INTERVAL_TICKS = 30;
const VILLAGE_FOOD_PER_RESIDENT = 2;
const VILLAGE_BASE_HOUSING = 12;
const VILLAGE_MAX_HOUSING = 60;
const VILLAGE_BASE_FOOD_CAPACITY = 120;
const HUT_HOUSING_BONUS = 6;
const STORAGE_FOOD_CAPACITY_BONUS = 140;
const FARM_FOOD_PER_TICK = 3;
const BUILDING_INTERVAL_TICKS = 60;
const BUILDING_COSTS: Record<VillageBuildingType, number> = {
  hut: 45,
  storage: 60,
  farm: 70,
};
const BUILDING_TERRITORY_RADIUS = 4;
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
const ARMY_MIN_SOLDIERS = 4;
const ARMY_MAX_SOLDIERS = 32;
const ARMY_SPEED_PER_TICK = 0.8;
const ARMY_BATTLE_DISTANCE = 1.2;
const DEFENDER_POPULATION_STRENGTH = 0.42;
const DEFENDER_BUILDING_STRENGTH = 1.8;
const ATTACKER_CAPTURE_ADVANTAGE = 0.92;
const KINGDOM_COLORS = [
  0xef7d57, 0xffcd75, 0x38b764, 0x29adff, 0x9b5de5, 0xf15bb5, 0x00f5d4, 0xc2c3c7,
];
const RECENT_EVENT_TYPES = new Set<SimEvent['type']>([
  'command_accepted',
  'command_rejected',
  'resource_placed',
  'terrain_changed',
  'lightning_struck',
  'speed_changed',
  'pause_changed',
  'village_founded',
  'village_declining',
  'village_abandoned',
  'building_built',
  'kingdom_founded',
  'kingdom_joined',
  'kingdom_capital_changed',
  'kingdom_fallen',
  'border_friction',
  'resource_pressure',
  'war_declared',
  'army_formed',
  'battle_resolved',
  'village_captured',
  'army_disbanded',
]);

type KingdomDiplomacyRelation = {
  pressure: number;
  warDeclared: boolean;
  armyFormed: boolean;
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
  private readonly kingdoms = new Map<string, Kingdom>();
  private readonly diplomacy = new Map<string, KingdomDiplomacyRelation>();
  private readonly buildings = new Map<string, VillageBuilding>();
  private readonly armies = new Map<string, ArmyGroup>();
  private readonly spatialIndex = new SpatialIndex();
  private tick = 0;
  private nextUnitId = 1;
  private nextEventId = 1;
  private nextVillageId = 1;
  private nextKingdomId = 1;
  private nextBuildingId = 1;
  private nextArmyId = 1;

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
    if (this.paused || this.speed === 0) {
      return;
    }

    this.tick += 1;
    this.drainCommands();
    this.spatialIndex.rebuild([...this.units.values()]);
    this.formVillages();
    this.updateUnits();
    this.spatialIndex.rebuild([...this.units.values()]);
    this.updateVillages();
    this.updateKingdoms();
    this.updateDiplomacy();
    this.updateArmies();
    this.spatialIndex.rebuild([...this.units.values()]);
  }

  project(): WorldProjection {
    const food = resourceTotals(this.map.tiles, 'food');
    const territory = this.projectTerritory();
    const territoryByVillage = this.countTerritoryByVillage(territory);
    const units = [...this.units.values()].map((unit) => cloneUnit(unit));
    const villages = [...this.villages.values()].map((village) =>
      cloneVillage(village, territoryByVillage.get(village.id) ?? 0),
    );
    const buildings = [...this.buildings.values()].map((building) => cloneBuilding(building));
    const kingdoms = [...this.kingdoms.values()].map((kingdom) => cloneKingdom(kingdom));
    const armies = [...this.armies.values()].map((army) => cloneArmy(army));
    const activeBuildings = buildings.filter((building) => building.status === 'active').length;
    const activeArmies = armies.filter((army) => army.status !== 'disbanded').length;
    const abandonedBuildings = buildings.filter(
      (building) => building.status === 'abandoned',
    ).length;
    const ruinedBuildings = buildings.filter((building) => building.status === 'ruined').length;
    const totalVillageFood = villages.reduce((total, village) => total + village.foodInventory, 0);
    const housingCapacity = villages.reduce((total, village) => total + village.housingCapacity, 0);
    const activeKingdoms = kingdoms.filter((kingdom) => kingdom.status !== 'fallen').length;
    const fallenKingdoms = kingdoms.length - activeKingdoms;

    return {
      tick: this.tick,
      seed: this.seed,
      width: this.map.width,
      height: this.map.height,
      speed: this.speed,
      paused: this.paused,
      tiles: this.map.tiles.map((tile) => ({
        ...tile,
        resource: tile.resource ? { ...tile.resource } : undefined,
      })),
      units,
      villages,
      kingdoms,
      buildings,
      armies,
      territory,
      recentEvents: this.events
        .filter((event) => RECENT_EVENT_TYPES.has(event.type))
        .slice(-12)
        .map((event) => ({ ...event })),
      stats: {
        population: units.length,
        villages: villages.length,
        kingdoms: activeKingdoms,
        fallenKingdoms,
        buildings: buildings.length,
        activeArmies,
        activeBuildings,
        abandonedBuildings,
        ruinedBuildings,
        territoryTiles: territory.length,
        foodTiles: food.tileCount,
        totalFood: food.amount,
        totalVillageFood,
        housingCapacity,
      },
    };
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
      food: this.map.tiles
        .filter((tile) => tile.resource?.type === 'food' && tile.resource.amount > 0)
        .map((tile) => `${tile.x},${tile.y},${tile.resource?.amount}`)
        .join('|'),
      villages: [...this.villages.values()].map(
        (village) =>
          `${village.id}:${village.race}:${round(village.center.x)},${round(
            village.center.y,
          )}:${village.population}:${round(village.foodInventory)}:${village.housingCapacity}:${
            village.status
          }`,
      ),
      buildings: [...this.buildings.values()].map(
        (building) =>
          `${building.id}:${building.villageId}:${building.type}:${round(
            building.position.x,
          )},${round(building.position.y)}:${building.status}`,
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
            army.status
          }`,
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
    }
  }

  private validateRadius(radius = 0) {
    if (radius < 0 || radius > MAX_COMMAND_RADIUS) {
      return `Command radius must be between 0 and ${MAX_COMMAND_RADIUS}.`;
    }

    return undefined;
  }

  private updateUnits() {
    const units = [...this.units.values()];

    for (const unit of units) {
      this.updateUnit(unit);
    }

    for (const unit of units) {
      if (unit.intent === 'dead') {
        this.units.delete(unit.id);
      }
    }
  }

  private updateUnit(unit: Unit) {
    if (unit.intent === 'dead') {
      return;
    }

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
        return;
      }
    }

    const foodTile = this.findNearbyFood(unit.position);

    if (unit.hunger > 35 && foodTile) {
      unit.intent = 'eat';
      const eaten = Math.min(4, foodTile.resource?.amount ?? 0);
      foodTile.resource!.amount -= eaten;
      unit.hunger = Math.max(0, unit.hunger - eaten * 10);
      this.emit('unit_ate', `${unit.id} ate food`, undefined, unit.id, unit.position, {
        amount: eaten,
      });

      if (foodTile.resource!.amount <= 0) {
        foodTile.resource = undefined;
      }
    } else if (unit.hunger > 35) {
      unit.intent = 'seek_food';
      this.moveUnitToward(
        unit,
        this.findNearestFoodPosition(unit.position) ?? this.randomNearbyPosition(unit.position),
      );
    } else {
      unit.intent = 'wander';
      this.moveUnitToward(unit, this.randomNearbyPosition(unit.position));
      this.tryReproduce(unit);
    }
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
        race: unit.race,
        center,
        population: locals.length,
        foodInventory: this.forageVillageFood(center, VILLAGE_INITIAL_FORAGE),
        foodCapacity: VILLAGE_BASE_FOOD_CAPACITY,
        housingCapacity: Math.max(VILLAGE_BASE_HOUSING, locals.length + 4),
        territoryTiles: 0,
        foundedAtTick: this.tick,
        status: 'camp',
      };

      this.nextVillageId += 1;
      this.villages.set(village.id, village);

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

  private updateVillages() {
    for (const unit of this.units.values()) {
      unit.villageId = undefined;
    }

    for (const village of [...this.villages.values()]) {
      const nearbyUnits = this.findUnitsNear(village.center, VILLAGE_RADIUS, village.race);

      for (const nearbyUnit of nearbyUnits) {
        if (!nearbyUnit.homeVillageId) {
          nearbyUnit.homeVillageId = village.id;
        }
      }

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

      for (const member of nearbyUnits) {
        if (member.homeVillageId !== village.id) {
          continue;
        }

        member.villageId = village.id;
      }

      this.produceFarmFood(village);
      village.foodInventory += this.forageVillageFood(village.center, VILLAGE_FORAGE_PER_TICK);
      village.foodInventory = Math.min(village.foodInventory, village.foodCapacity);

      if (
        village.status !== 'declining' &&
        village.foodInventory >= village.housingCapacity * 4 &&
        village.housingCapacity < VILLAGE_MAX_HOUSING
      ) {
        village.housingCapacity += 1;
      }

      this.tryBuildForVillage(village);

      if (
        this.tick <= village.foundedAtTick ||
        this.tick % VILLAGE_CONSUMPTION_INTERVAL_TICKS !== 0
      ) {
        continue;
      }

      const requiredFood = village.population * VILLAGE_FOOD_PER_RESIDENT;

      if (village.foodInventory >= requiredFood) {
        village.foodInventory -= requiredFood;
        village.status = 'stable';
        continue;
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
    }
  }

  private findUnitsNear(position: Position, radius: number, race?: UnitRace) {
    const units: Unit[] = [];

    for (const unit of this.units.values()) {
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
    return [...this.units.values()].filter(
      (unit) => unit.intent !== 'dead' && unit.homeVillageId === villageId,
    );
  }

  private produceFarmFood(village: Village) {
    const farms = this.findVillageBuildings(village.id, 'farm').length;

    if (farms <= 0) {
      return;
    }

    village.foodInventory = Math.min(
      village.foodCapacity,
      village.foodInventory + farms * FARM_FOOD_PER_TICK,
    );
  }

  private tryBuildForVillage(village: Village) {
    if (this.tick <= village.foundedAtTick || this.tick % BUILDING_INTERVAL_TICKS !== 0) {
      return;
    }

    const type = this.chooseNextBuilding(village);

    if (!type || village.foodInventory < BUILDING_COSTS[type]) {
      return;
    }

    village.foodInventory -= BUILDING_COSTS[type];
    const building = this.createBuilding(village, type);
    this.buildings.set(building.id, building);

    switch (type) {
      case 'hut':
        village.housingCapacity = Math.min(
          VILLAGE_MAX_HOUSING,
          village.housingCapacity + HUT_HOUSING_BONUS,
        );
        break;
      case 'storage':
        village.foodCapacity += STORAGE_FOOD_CAPACITY_BONUS;
        break;
      case 'farm':
        break;
    }

    this.emit(
      'building_built',
      `${building.id} ${type} built`,
      undefined,
      undefined,
      building.position,
      {
        villageId: village.id,
        type,
      },
    );
  }

  private chooseNextBuilding(village: Village): VillageBuildingType | undefined {
    const buildings = this.findVillageBuildings(village.id);
    const huts = buildings.filter((building) => building.type === 'hut').length;
    const storage = buildings.filter((building) => building.type === 'storage').length;
    const farms = buildings.filter((building) => building.type === 'farm').length;

    if (huts === 0) {
      return 'hut';
    }

    if (storage === 0) {
      return 'storage';
    }

    if (farms < 2) {
      return 'farm';
    }

    if (
      village.population >= village.housingCapacity - 2 &&
      village.housingCapacity < VILLAGE_MAX_HOUSING
    ) {
      return 'hut';
    }

    return undefined;
  }

  private createBuilding(village: Village, type: VillageBuildingType): VillageBuilding {
    const buildingCount = this.findVillageBuildings(village.id).length;
    const angle = buildingCount * 2.399963229728653;
    const radius = 2 + (buildingCount % 4);
    const position = this.findBuildablePosition({
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
    };

    this.nextBuildingId += 1;
    return building;
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

  private findVillageBuildings(villageId: string, type?: VillageBuildingType) {
    return [...this.buildings.values()].filter(
      (building) =>
        building.status === 'active' &&
        building.villageId === villageId &&
        (!type || building.type === type),
    );
  }

  private abandonVillageBuildings(villageId: string) {
    for (const building of this.buildings.values()) {
      if (building.villageId === villageId && building.status === 'active') {
        building.status = 'abandoned';
      }
    }
  }

  private projectTerritory() {
    const claims = new Map<string, { villageId: string; kingdomId?: string }>();

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

    return [...claims.entries()].map(([key, claim]) => {
      const [x, y] = key.split(':').map(Number);
      return { x, y, villageId: claim.villageId, kingdomId: claim.kingdomId };
    });
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
      .filter((village): village is Village => Boolean(village));

    kingdom.villageIds = villages.map((village) => village.id);

    if (villages.length === 0) {
      if (kingdom.status !== 'fallen') {
        kingdom.status = 'fallen';
        kingdom.population = 0;
        kingdom.buildingCount = 0;
        kingdom.territoryTiles = 0;
        kingdom.foodInventory = 0;
        kingdom.diplomacyPressure = 0;
        kingdom.diplomacyTargetKingdomId = undefined;
        this.emit('kingdom_fallen', `${kingdom.id} fallen`);
      }

      return;
    }

    const capital = this.villages.get(kingdom.capitalVillageId);
    const nextCapital = [...villages].sort((a, b) => b.population - a.population)[0];

    if (!capital || nextCapital.population > capital.population) {
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
        this.tryDeclareWar(relation, left, right, borderPressure, resourcePressure, raceModifier);
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

  private chooseWarDeclarer(left: Kingdom, right: Kingdom) {
    const leftScore = this.raceAggression(left.race) + this.kingdomFoodDeficit(left) / 4;
    const rightScore = this.raceAggression(right.race) + this.kingdomFoodDeficit(right) / 4;

    return leftScore >= rightScore ? left : right;
  }

  private formArmyGroup(aggressor: Kingdom, target: Kingdom, relation: KingdomDiplomacyRelation) {
    if (relation.armyFormed || this.hasActiveArmyAgainst(aggressor.id, target.id)) {
      return;
    }

    const originVillage = this.villages.get(aggressor.capitalVillageId);
    const targetVillage = this.villages.get(target.capitalVillageId);

    if (!originVillage || !targetVillage || originVillage.population < ARMY_MIN_SOLDIERS) {
      return;
    }

    const soldierCount = Math.min(
      ARMY_MAX_SOLDIERS,
      Math.max(ARMY_MIN_SOLDIERS, Math.floor(originVillage.population * ARMY_MOBILIZATION_RATIO)),
    );
    const army: ArmyGroup = {
      id: `army-${String(this.nextArmyId).padStart(5, '0')}`,
      kingdomId: aggressor.id,
      targetKingdomId: target.id,
      originVillageId: originVillage.id,
      targetVillageId: targetVillage.id,
      position: { ...originVillage.center },
      soldierCount,
      morale: 1,
      formedAtTick: this.tick,
      status: 'marching',
    };

    this.nextArmyId += 1;
    this.armies.set(army.id, army);
    relation.armyFormed = true;
    this.emit('army_formed', `${army.id} formed`, undefined, undefined, army.position, {
      kingdomId: army.kingdomId,
      targetKingdomId: army.targetKingdomId,
      soldiers: army.soldierCount,
      originVillageId: army.originVillageId,
      targetVillageId: army.targetVillageId,
    });
  }

  private hasActiveArmyAgainst(kingdomId: string, targetKingdomId: string) {
    for (const army of this.armies.values()) {
      if (
        army.status !== 'disbanded' &&
        army.kingdomId === kingdomId &&
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
        this.resolveArmyBattle(army, targetVillage);
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

  private resolveArmyBattle(army: ArmyGroup, targetVillage: Village) {
    const attacker = this.kingdoms.get(army.kingdomId);
    const defender = this.kingdoms.get(army.targetKingdomId);

    if (!attacker || !defender) {
      this.disbandArmy(army, 'missing kingdom');
      return;
    }

    army.status = 'fighting';
    const defenderBuildings = this.findVillageBuildings(targetVillage.id).length;
    const attackerStrength = army.soldierCount * army.morale * this.raceAggression(attacker.race);
    const defenderStrength =
      targetVillage.population * DEFENDER_POPULATION_STRENGTH +
      defenderBuildings * DEFENDER_BUILDING_STRENGTH;
    const attackerCasualties = Math.min(
      army.soldierCount,
      Math.max(1, Math.floor(defenderStrength / 4)),
    );
    const defenderCasualties = Math.min(
      targetVillage.population,
      Math.max(1, Math.floor(attackerStrength / 3)),
    );

    army.soldierCount -= attackerCasualties;
    this.removeCasualtiesFromVillage(army.originVillageId, attackerCasualties, 'battle');
    this.removeCasualtiesFromVillage(targetVillage.id, defenderCasualties, 'battle');

    const captured =
      army.soldierCount > 0 && attackerStrength >= defenderStrength * ATTACKER_CAPTURE_ADVANTAGE;

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
      },
    );

    if (captured) {
      this.captureVillage(targetVillage, attacker, defender);
      this.disbandArmy(army, 'captured target');
      return;
    }

    army.status = 'retreating';
    this.disbandArmy(army, 'retreated');
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
    forEachTileInRadius(this.map, position, radius, (tile) => {
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
    center: {
      x: round(village.center.x),
      y: round(village.center.y),
    },
    foodInventory: round(village.foodInventory),
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

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
