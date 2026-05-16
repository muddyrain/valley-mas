import type * as Phaser from 'phaser';
import {
  Faction,
  type FactionInventory,
  type FactionOptions,
  type FactionRelation,
} from './Faction';

export type FactionExtinctionResult = {
  faction: Faction;
  extinct: boolean;
};

export class FactionManager {
  private readonly factions = new Map<string, Faction>();
  private readonly unitToFaction = new Map<string, string>();

  createFaction(options: FactionOptions) {
    const faction = new Faction(options);
    return this.registerFaction(faction);
  }

  registerFaction(faction: Faction) {
    const existing = this.factions.get(faction.id);

    if (existing) {
      return existing;
    }

    this.factions.set(faction.id, faction);
    this.seedRelations(faction);

    return faction;
  }

  getFaction(factionId: string) {
    return this.factions.get(factionId);
  }

  getFactions() {
    return [...this.factions.values()];
  }

  getFactionForUnit(unitId: string) {
    const factionId = this.unitToFaction.get(unitId);

    if (!factionId) {
      return undefined;
    }

    return this.getFaction(factionId);
  }

  getFactionPopulation(factionId: string) {
    return this.getFaction(factionId)?.population ?? 0;
  }

  getTotalPopulation() {
    return this.getFactions().reduce((total, faction) => total + faction.population, 0);
  }

  getFactionColorValue(factionId: string) {
    return this.getFaction(factionId)?.getColorValue() ?? 0x1a1c2c;
  }

  getFactionName(factionId: string) {
    return this.getFaction(factionId)?.name ?? factionId;
  }

  getFactionInventory(factionId: string) {
    return this.getFaction(factionId)?.getInventory();
  }

  attachUnit(unitId: string, factionId: string, options: { isLeader?: boolean } = {}) {
    const currentFactionId = this.unitToFaction.get(unitId);

    if (currentFactionId === factionId) {
      const faction = this.getFaction(factionId);

      if (faction && options.isLeader) {
        faction.setLeaderUnitId(unitId);
      }

      return faction;
    }

    if (currentFactionId) {
      this.detachUnit(unitId);
    }

    const faction = this.getFaction(factionId);

    if (!faction) {
      return undefined;
    }

    this.unitToFaction.set(unitId, factionId);
    faction.addPopulation(1);

    if (options.isLeader || !faction.leaderUnitId) {
      faction.setLeaderUnitId(unitId);
    }

    return faction;
  }

  detachUnit(unitId: string): FactionExtinctionResult | undefined {
    const factionId = this.unitToFaction.get(unitId);

    if (!factionId) {
      return undefined;
    }

    const faction = this.getFaction(factionId);
    this.unitToFaction.delete(unitId);

    if (!faction) {
      return undefined;
    }

    faction.removePopulation(1);

    if (faction.leaderUnitId === unitId) {
      faction.setLeaderUnitId(this.findFallbackLeader(factionId));
    }

    if (faction.isExtinct()) {
      this.factions.delete(factionId);
      return {
        faction,
        extinct: true,
      };
    }

    return {
      faction,
      extinct: false,
    };
  }

  setFactionCapital(factionId: string, capitalPosition: Phaser.Math.Vector2) {
    this.getFaction(factionId)?.setCapitalPosition(capitalPosition);
  }

  setFactionTerritoryCount(factionId: string, territoryCount: number) {
    this.getFaction(factionId)?.setTerritoryCount(territoryCount);
  }

  setFactionRelation(factionId: string, targetFactionId: string, relation: FactionRelation) {
    const faction = this.getFaction(factionId);
    const targetFaction = this.getFaction(targetFactionId);

    faction?.setRelation(targetFactionId, relation);
    targetFaction?.setRelation(factionId, relation);
  }

  replaceFactionInventory(factionId: string, inventory: Partial<FactionInventory>) {
    this.getFaction(factionId)?.replaceInventory(inventory);
  }

  clear() {
    this.factions.clear();
    this.unitToFaction.clear();
  }

  private seedRelations(faction: Faction) {
    for (const otherFaction of this.factions.values()) {
      if (otherFaction.id === faction.id) {
        continue;
      }

      if (faction.getRelation(otherFaction.id) === 'neutral') {
        faction.setRelation(otherFaction.id, 'neutral');
      }

      if (otherFaction.getRelation(faction.id) === 'neutral') {
        otherFaction.setRelation(faction.id, 'neutral');
      }
    }
  }

  private findFallbackLeader(factionId: string) {
    for (const [unitId, linkedFactionId] of this.unitToFaction) {
      if (linkedFactionId === factionId) {
        return unitId;
      }
    }

    return undefined;
  }
}
