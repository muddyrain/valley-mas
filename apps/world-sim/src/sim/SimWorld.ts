import { createWorldMap, forEachTileInRadius, getTile, isWalkable, resourceTotals } from './map';
import { SeededRng } from './rng';
import { SpatialIndex } from './spatialIndex';
import type {
  Position,
  ResourceType,
  SimCommand,
  SimEvent,
  SimWorldOptions,
  TerrainType,
  Unit,
  UnitGender,
  UnitRace,
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

export class SimWorld {
  readonly seed: string;
  readonly map;

  speed: 0 | 1 | 2 | 4 = 1;
  paused = false;

  private readonly rng: SeededRng;
  private readonly commands: SimCommand[] = [];
  private readonly events: SimEvent[] = [];
  private readonly units = new Map<string, Unit>();
  private readonly spatialIndex = new SpatialIndex();
  private tick = 0;
  private nextUnitId = 1;
  private nextEventId = 1;

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
    this.updateUnits();
    this.spatialIndex.rebuild([...this.units.values()]);
  }

  project(): WorldProjection {
    const food = resourceTotals(this.map.tiles, 'food');
    const units = [...this.units.values()].map((unit) => cloneUnit(unit));

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
      recentEvents: this.events.slice(-12).map((event) => ({ ...event })),
      stats: {
        population: units.length,
        foodTiles: food.tileCount,
        totalFood: food.amount,
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
      })),
      food: this.map.tiles
        .filter((tile) => tile.resource?.type === 'food' && tile.resource.amount > 0)
        .map((tile) => `${tile.x},${tile.y},${tile.resource?.amount}`)
        .join('|'),
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
    });

    this.units.set(child.id, child);
    this.emit('unit_born', `${child.id} was born`, undefined, child.id, child.position, {
      parentA: first.id,
      parentB: partner.id,
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(a: Position, b: Position) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}
