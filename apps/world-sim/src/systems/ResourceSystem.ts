import * as Phaser from 'phaser';
import type { ResourceType, TerrainTile, TestWorldMap } from '../world/testMap';

export type HarvestResult = {
  resourceType: ResourceType;
  amount: number;
  tile: TerrainTile;
  depleted: boolean;
};

const HARVEST_YIELD: Record<ResourceType, number> = {
  food: 1,
  wood: 2,
  stone: 3,
  iron: 3,
};

const RESOURCE_LABELS: Record<ResourceType, string> = {
  food: '粮',
  wood: '木',
  stone: '石',
  iron: '铁',
};

const RESOURCE_COLORS: Record<ResourceType, number> = {
  food: 0xffcd75,
  wood: 0x38b764,
  stone: 0x94b0c2,
  iron: 0xef7d57,
};

const INITIAL_INVENTORY: Record<ResourceType, number> = {
  food: 0,
  wood: 10,
  stone: 0,
  iron: 0,
};

export const STOCKPILE_TARGETS: Record<ResourceType, number> = {
  food: 40,
  wood: 200,
  stone: 120,
  iron: 60,
};

const HARVEST_PRIORITY_ORDER: ResourceType[] = ['food', 'wood', 'stone', 'iron'];

export class ResourceSystem {
  private readonly inventory: Record<ResourceType, number> = { ...INITIAL_INVENTORY };
  private dirty = true;

  constructor(private readonly map: TestWorldMap) {}

  getInventory() {
    return { ...this.inventory };
  }

  getInventorySummary() {
    return `库存：粮${this.inventory.food} 木${this.inventory.wood} 石${this.inventory.stone} 铁${this.inventory.iron}`;
  }

  getStockpileTargets() {
    return { ...STOCKPILE_TARGETS };
  }

  needsHarvest() {
    return this.getHarvestPriorityTypes().length > 0;
  }

  getHarvestPriorityTypes() {
    return HARVEST_PRIORITY_ORDER.filter(
      (resourceType) => this.inventory[resourceType] < STOCKPILE_TARGETS[resourceType],
    );
  }

  getActiveHarvestPriorityTypes() {
    for (const resourceType of this.getHarvestPriorityTypes()) {
      if (this.hasHarvestableResource([resourceType])) {
        return [resourceType];
      }
    }

    return [];
  }

  findNextHarvestTarget(from: Phaser.Math.Vector2) {
    const activeTypes = this.getActiveHarvestPriorityTypes();

    if (activeTypes.length === 0) {
      return undefined;
    }

    return this.findNearestHarvestTarget(from, activeTypes);
  }

  canAfford(cost: Partial<Record<ResourceType, number>>) {
    return Object.entries(cost).every(([resourceType, amount]) => {
      return this.inventory[resourceType as ResourceType] >= (amount ?? 0);
    });
  }

  spend(cost: Partial<Record<ResourceType, number>>) {
    if (!this.canAfford(cost)) {
      return false;
    }

    for (const [resourceType, amount] of Object.entries(cost)) {
      this.inventory[resourceType as ResourceType] -= amount ?? 0;
    }

    this.dirty = true;
    return true;
  }

  getResourceLabel(resourceType: ResourceType) {
    return RESOURCE_LABELS[resourceType];
  }

  getResourceColor(resourceType: ResourceType) {
    return RESOURCE_COLORS[resourceType];
  }

  consumeDirty() {
    const wasDirty = this.dirty;
    this.dirty = false;
    return wasDirty;
  }

  hasHarvestableResource(resourceTypes?: ResourceType[]) {
    const allowedTypes =
      resourceTypes && resourceTypes.length > 0 ? new Set(resourceTypes) : undefined;

    return this.map.tiles.some((tile) => {
      if (!tile.resourceType || tile.resourceAmount <= 0) {
        return false;
      }

      if (allowedTypes && !allowedTypes.has(tile.resourceType)) {
        return false;
      }

      return tile.terrainType !== 'water' && tile.terrainType !== 'lava';
    });
  }

  findNearestHarvestTarget(from: Phaser.Math.Vector2, resourceTypes?: ResourceType[]) {
    const allowedTypes =
      resourceTypes && resourceTypes.length > 0 ? new Set(resourceTypes) : undefined;
    let closestTile: TerrainTile | undefined;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const tile of this.map.tiles) {
      if (!tile.resourceType || tile.resourceAmount <= 0) {
        continue;
      }

      if (allowedTypes && !allowedTypes.has(tile.resourceType)) {
        continue;
      }

      if (tile.terrainType === 'water' || tile.terrainType === 'lava') {
        continue;
      }

      const tileCenterX = tile.x * this.map.tileSize + this.map.tileSize / 2;
      const tileCenterY = tile.y * this.map.tileSize + this.map.tileSize / 2;
      const distance = Phaser.Math.Distance.Between(from.x, from.y, tileCenterX, tileCenterY);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestTile = tile;
      }
    }

    if (!closestTile) {
      return undefined;
    }

    return new Phaser.Math.Vector2(
      closestTile.x * this.map.tileSize + this.map.tileSize / 2,
      closestTile.y * this.map.tileSize + this.map.tileSize / 2,
    );
  }

  harvestAt(position: Phaser.Math.Vector2): HarvestResult | undefined {
    const tileX = Math.floor(position.x / this.map.tileSize);
    const tileY = Math.floor(position.y / this.map.tileSize);
    const tile = this.map.tiles[tileY * this.map.width + tileX];

    if (!tile || !tile.resourceType || tile.resourceAmount <= 0) {
      return undefined;
    }

    const resourceType = tile.resourceType;
    const amount = Math.min(HARVEST_YIELD[resourceType], tile.resourceAmount);

    tile.resourceAmount -= amount;
    this.inventory[resourceType] += amount;
    this.dirty = true;

    const depleted = tile.resourceAmount <= 0;

    if (depleted) {
      tile.resourceType = undefined;
      tile.resourceAmount = 0;

      if (tile.terrainType === 'forest') {
        tile.terrainType = 'grass';
      }
    }

    return {
      resourceType,
      amount,
      tile,
      depleted,
    };
  }
}
