import type * as Phaser from 'phaser';

export type FactionRace = 'human' | 'orc' | 'elf' | 'dwarf';
export type FactionResourceType = 'food' | 'wood' | 'stone' | 'iron';
export type FactionRelation = string;

export type FactionInventory = Record<FactionResourceType, number>;

export type FactionOptions = {
  id: string;
  name: string;
  race: FactionRace;
  color: string;
  capitalPosition: Phaser.Math.Vector2;
  leaderUnitId?: string;
  population?: number;
  territoryCount?: number;
  relations?: Record<string, FactionRelation>;
  inventory?: Partial<FactionInventory>;
};

const DEFAULT_INVENTORY: FactionInventory = {
  food: 0,
  wood: 0,
  stone: 0,
  iron: 0,
};

export class Faction {
  readonly id: string;
  readonly name: string;
  readonly race: FactionRace;
  readonly color: string;
  readonly relations: Record<string, FactionRelation>;
  readonly inventory: FactionInventory;

  capitalPosition: Phaser.Math.Vector2;
  leaderUnitId?: string;
  population: number;
  territoryCount: number;

  constructor(options: FactionOptions) {
    this.id = options.id;
    this.name = options.name;
    this.race = options.race;
    this.color = normalizeColor(options.color);
    this.capitalPosition = options.capitalPosition.clone();
    this.leaderUnitId = options.leaderUnitId;
    this.population = Math.max(0, Math.floor(options.population ?? 0));
    this.territoryCount = Math.max(0, Math.floor(options.territoryCount ?? 0));
    this.relations = { ...(options.relations ?? {}) };
    this.inventory = { ...DEFAULT_INVENTORY, ...(options.inventory ?? {}) };
  }

  getColorValue() {
    return parseColorToNumber(this.color);
  }

  getRelation(factionId: string) {
    return this.relations[factionId] ?? 'neutral';
  }

  setRelation(factionId: string, relation: FactionRelation) {
    this.relations[factionId] = relation;
  }

  addPopulation(amount = 1) {
    this.population = Math.max(0, this.population + Math.floor(amount));
  }

  removePopulation(amount = 1) {
    this.population = Math.max(0, this.population - Math.floor(amount));
  }

  isExtinct() {
    return this.population <= 0;
  }

  setCapitalPosition(position: Phaser.Math.Vector2) {
    this.capitalPosition = position.clone();
  }

  setLeaderUnitId(unitId?: string) {
    this.leaderUnitId = unitId;
  }

  setTerritoryCount(territoryCount: number) {
    this.territoryCount = Math.max(0, Math.floor(territoryCount));
  }

  replaceInventory(snapshot: Partial<FactionInventory>) {
    this.inventory.food = Math.max(0, Math.floor(snapshot.food ?? 0));
    this.inventory.wood = Math.max(0, Math.floor(snapshot.wood ?? 0));
    this.inventory.stone = Math.max(0, Math.floor(snapshot.stone ?? 0));
    this.inventory.iron = Math.max(0, Math.floor(snapshot.iron ?? 0));
  }

  getInventory() {
    return { ...this.inventory };
  }

  getInventorySummary() {
    return `库存：粮${this.inventory.food} 木${this.inventory.wood} 石${this.inventory.stone} 铁${this.inventory.iron}`;
  }
}

function normalizeColor(color: string) {
  const trimmed = color.trim();

  if (trimmed.startsWith('#')) {
    return trimmed.toLowerCase();
  }

  if (/^0x/i.test(trimmed)) {
    return `#${trimmed.slice(2).toLowerCase()}`;
  }

  return `#${trimmed.toLowerCase()}`;
}

function parseColorToNumber(color: string) {
  const hex = normalizeColor(color).slice(1);
  const parsed = Number.parseInt(hex, 16);

  return Number.isNaN(parsed) ? 0x1a1c2c : parsed;
}
