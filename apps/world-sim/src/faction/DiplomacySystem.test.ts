import * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { DiplomacySystem } from './DiplomacySystem';
import { FactionManager } from './FactionManager';

function createFactionManager() {
  const factionManager = new FactionManager();

  factionManager.createFaction({
    id: 'faction-1',
    name: '人类营地',
    race: 'human',
    color: '#5d9e4f',
    capitalPosition: new Phaser.Math.Vector2(32, 32),
  });
  factionManager.createFaction({
    id: 'faction-2',
    name: '兽人部落',
    race: 'orc',
    color: '#b55945',
    capitalPosition: new Phaser.Math.Vector2(96, 32),
  });
  factionManager.createFaction({
    id: 'faction-3',
    name: '精灵林地',
    race: 'elf',
    color: '#5b6ee1',
    capitalPosition: new Phaser.Math.Vector2(160, 32),
  });

  return factionManager;
}

describe('DiplomacySystem', () => {
  it('declares war when neutral factions have adjacent territory', () => {
    const factionManager = createFactionManager();
    const diplomacySystem = new DiplomacySystem(factionManager);

    const declarations = diplomacySystem.evaluateTerritoryContacts([
      {
        firstFactionId: 'faction-1',
        secondFactionId: 'faction-2',
      },
    ]);

    expect(declarations).toHaveLength(1);
    expect(declarations[0]).toMatchObject({
      firstFactionId: 'faction-1',
      secondFactionId: 'faction-2',
    });
    expect(declarations[0].rallyPoint).toBeInstanceOf(Phaser.Math.Vector2);
    expect(diplomacySystem.isAtWar('faction-1', 'faction-2')).toBe(true);
    expect(diplomacySystem.isAtWar('faction-1', 'faction-3')).toBe(false);
    expect(declarations[0].rallyPoint.x).toBeCloseTo(64);
    expect(declarations[0].rallyPoint.y).toBeCloseTo(32);
  });

  it('does not duplicate declarations for factions already at war', () => {
    const factionManager = createFactionManager();
    const diplomacySystem = new DiplomacySystem(factionManager);

    diplomacySystem.evaluateTerritoryContacts([
      {
        firstFactionId: 'faction-1',
        secondFactionId: 'faction-2',
      },
    ]);

    const declarations = diplomacySystem.evaluateTerritoryContacts([
      {
        firstFactionId: 'faction-1',
        secondFactionId: 'faction-2',
      },
    ]);

    expect(declarations).toEqual([]);
  });

  it('formats active relation summaries for the HUD', () => {
    const factionManager = createFactionManager();
    const diplomacySystem = new DiplomacySystem(factionManager);

    diplomacySystem.evaluateTerritoryContacts([
      {
        firstFactionId: 'faction-1',
        secondFactionId: 'faction-2',
      },
    ]);

    expect(diplomacySystem.getRelationSummaryLines()).toEqual([
      '外交：人类营地 / 兽人部落 战争',
      '外交：人类营地 / 精灵林地 中立',
      '外交：兽人部落 / 精灵林地 中立',
    ]);
  });

  it('resets relations to neutral when a faction is defeated', () => {
    const factionManager = createFactionManager();
    const diplomacySystem = new DiplomacySystem(factionManager);

    diplomacySystem.evaluateTerritoryContacts([
      {
        firstFactionId: 'faction-1',
        secondFactionId: 'faction-2',
      },
    ]);

    diplomacySystem.resetRelationsForFaction('faction-2');

    expect(diplomacySystem.isAtWar('faction-1', 'faction-2')).toBe(false);
    expect(diplomacySystem.getRelationSummaryLines()).toEqual([
      '外交：人类营地 / 兽人部落 中立',
      '外交：人类营地 / 精灵林地 中立',
      '外交：兽人部落 / 精灵林地 中立',
    ]);
  });
});
