import type * as Phaser from 'phaser';
import type { TerrainTile, TestWorldMap } from '../world/testMap';

export type TerritoryClaimResult = {
  claimedCount: number;
  changedTiles: TerrainTile[];
};

export type TerritoryContactPair = {
  firstFactionId: string;
  secondFactionId: string;
};

export const DEFAULT_TERRITORY_RADIUS_TILES = 3;

export class TerritorySystem {
  constructor(private readonly map: TestWorldMap) {}

  claimAroundWorldPoint(
    factionId: string,
    worldPoint: Phaser.Math.Vector2,
    radiusTiles = DEFAULT_TERRITORY_RADIUS_TILES,
  ): TerritoryClaimResult {
    const centerX = Math.floor(worldPoint.x / this.map.tileSize);
    const centerY = Math.floor(worldPoint.y / this.map.tileSize);
    const radius = Math.max(0, Math.floor(radiusTiles));
    const changedTiles: TerrainTile[] = [];

    for (let y = centerY - radius; y <= centerY + radius; y += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        const tile = this.getTile(x, y);

        if (!tile || tile.ownerFactionId === factionId) {
          continue;
        }

        tile.ownerFactionId = factionId;
        changedTiles.push(tile);
      }
    }

    return {
      claimedCount: changedTiles.length,
      changedTiles,
    };
  }

  getTerritoryCount(factionId: string) {
    return this.map.tiles.reduce((count, tile) => {
      return tile.ownerFactionId === factionId ? count + 1 : count;
    }, 0);
  }

  getAdjacentFactionPairs(): TerritoryContactPair[] {
    const pairKeys = new Set<string>();

    for (const tile of this.map.tiles) {
      if (!tile.ownerFactionId) {
        continue;
      }

      for (const neighbor of this.getCardinalNeighbors(tile.x, tile.y)) {
        if (!neighbor.ownerFactionId || neighbor.ownerFactionId === tile.ownerFactionId) {
          continue;
        }

        pairKeys.add(this.createPairKey(tile.ownerFactionId, neighbor.ownerFactionId));
      }
    }

    return [...pairKeys].sort().map((key) => {
      const [firstFactionId, secondFactionId] = key.split('|');

      return {
        firstFactionId,
        secondFactionId,
      };
    });
  }

  private getTile(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height) {
      return undefined;
    }

    return this.map.tiles[y * this.map.width + x];
  }

  private getCardinalNeighbors(x: number, y: number) {
    return [
      this.getTile(x + 1, y),
      this.getTile(x - 1, y),
      this.getTile(x, y + 1),
      this.getTile(x, y - 1),
    ].filter((tile): tile is TerrainTile => Boolean(tile));
  }

  private createPairKey(firstFactionId: string, secondFactionId: string) {
    return [firstFactionId, secondFactionId].sort().join('|');
  }
}
