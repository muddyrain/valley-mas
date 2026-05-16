import * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { FactionManager } from './FactionManager';

describe('FactionManager', () => {
  it('registers factions, seeds neutral relations, and tracks population by unit', () => {
    const manager = new FactionManager();
    const firstFaction = manager.createFaction({
      id: 'faction-1',
      name: '人类营地',
      race: 'human',
      color: '#5d9e4f',
      capitalPosition: new Phaser.Math.Vector2(32, 32),
    });
    const secondFaction = manager.createFaction({
      id: 'faction-2',
      name: '兽人部落',
      race: 'orc',
      color: '#b55945',
      capitalPosition: new Phaser.Math.Vector2(80, 80),
    });

    expect(firstFaction.getRelation('faction-2')).toBe('neutral');
    expect(secondFaction.getRelation('faction-1')).toBe('neutral');

    manager.attachUnit('unit-1', 'faction-1');
    manager.attachUnit('unit-2', 'faction-1');
    manager.attachUnit('unit-3', 'faction-2');

    expect(manager.getFactionPopulation('faction-1')).toBe(2);
    expect(manager.getFactionPopulation('faction-2')).toBe(1);
    expect(manager.getTotalPopulation()).toBe(3);
    expect(manager.getFactionForUnit('unit-1')?.id).toBe('faction-1');
    expect(manager.getFaction('faction-1')?.leaderUnitId).toBe('unit-1');
  });

  it('removes extinct factions after the last unit detaches', () => {
    const manager = new FactionManager();
    manager.createFaction({
      id: 'faction-1',
      name: '人类营地',
      race: 'human',
      color: '#5d9e4f',
      capitalPosition: new Phaser.Math.Vector2(32, 32),
    });

    manager.attachUnit('unit-1', 'faction-1');

    const result = manager.detachUnit('unit-1');

    expect(result).toMatchObject({
      extinct: true,
      faction: expect.objectContaining({
        id: 'faction-1',
        population: 0,
      }),
    });
    expect(manager.getFaction('faction-1')).toBeUndefined();
  });
});
