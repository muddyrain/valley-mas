import * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { Faction } from './Faction';

describe('Faction', () => {
  it('tracks identity, inventory, territory, and color', () => {
    const faction = new Faction({
      id: 'faction-1',
      name: '人类营地',
      race: 'human',
      color: '#5d9e4f',
      capitalPosition: new Phaser.Math.Vector2(32, 32),
    });

    faction.addPopulation();
    faction.addPopulation(2);
    faction.removePopulation();
    faction.setTerritoryCount(7);
    faction.setRelation('faction-2', 'war');
    faction.replaceInventory({
      food: 1,
      wood: 12,
      stone: 4,
      iron: 0,
    });

    expect(faction.population).toBe(2);
    expect(faction.territoryCount).toBe(7);
    expect(faction.getRelation('faction-2')).toBe('war');
    expect(faction.getColorValue()).toBe(0x5d9e4f);
    expect(faction.getInventory()).toEqual({
      food: 1,
      wood: 12,
      stone: 4,
      iron: 0,
    });
    expect(faction.getInventorySummary()).toBe('库存：粮1 木12 石4 铁0');
    expect(faction.capitalPosition).toEqual(new Phaser.Math.Vector2(32, 32));
  });
});
