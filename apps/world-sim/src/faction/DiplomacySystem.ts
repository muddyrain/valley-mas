import * as Phaser from 'phaser';
import type { FactionRelation } from './Faction';
import type { FactionManager } from './FactionManager';
import type { TerritoryContactPair } from './TerritorySystem';

export type DiplomacyDeclaration = TerritoryContactPair & {
  rallyPoint: Phaser.Math.Vector2;
};

const RELATION_LABELS: Record<FactionRelation, string> = {
  neutral: '中立',
  war: '战争',
};

export class DiplomacySystem {
  constructor(private readonly factionManager: FactionManager) {}

  evaluateTerritoryContacts(contactPairs: TerritoryContactPair[]): DiplomacyDeclaration[] {
    const declarations: DiplomacyDeclaration[] = [];

    for (const pair of contactPairs) {
      if (this.isAtWar(pair.firstFactionId, pair.secondFactionId)) {
        continue;
      }

      this.factionManager.setFactionRelation(pair.firstFactionId, pair.secondFactionId, 'war');
      declarations.push({
        ...pair,
        rallyPoint: this.getRallyPoint(pair.firstFactionId, pair.secondFactionId),
      });
    }

    return declarations;
  }

  isAtWar(firstFactionId: string, secondFactionId: string) {
    return this.getRelation(firstFactionId, secondFactionId) === 'war';
  }

  getRelationSummaryLines() {
    const factions = this.factionManager.getFactions();
    const lines: string[] = [];

    for (let firstIndex = 0; firstIndex < factions.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < factions.length; secondIndex += 1) {
        const firstFaction = factions[firstIndex];
        const secondFaction = factions[secondIndex];
        const relation = this.getRelation(firstFaction.id, secondFaction.id);

        lines.push(
          `外交：${firstFaction.name} / ${secondFaction.name} ${this.getRelationLabel(relation)}`,
        );
      }
    }

    return lines;
  }

  resetRelationsForFaction(factionId: string) {
    for (const faction of this.factionManager.getFactions()) {
      faction.clearRelation(factionId);
    }
  }

  private getRelation(firstFactionId: string, secondFactionId: string): FactionRelation {
    return (
      this.factionManager.getFaction(firstFactionId)?.getRelation(secondFactionId) ?? 'neutral'
    );
  }

  private getRelationLabel(relation: FactionRelation) {
    return RELATION_LABELS[relation] ?? relation;
  }

  private getRallyPoint(firstFactionId: string, secondFactionId: string) {
    const firstFaction = this.factionManager.getFaction(firstFactionId);
    const secondFaction = this.factionManager.getFaction(secondFactionId);

    if (!firstFaction || !secondFaction) {
      return new Phaser.Math.Vector2(0, 0);
    }

    return new Phaser.Math.Vector2(
      (firstFaction.capitalPosition.x + secondFaction.capitalPosition.x) / 2,
      (firstFaction.capitalPosition.y + secondFaction.capitalPosition.y) / 2,
    );
  }
}
