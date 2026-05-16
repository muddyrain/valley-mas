import type { DiplomacyDeclaration } from '../faction/DiplomacySystem';

export type MobilizableUnit = {
  factionId: string;
  isDead: boolean;
  moveTo: (x: number, y: number) => void;
};

const UNIT_SPACING = 18;
const FORMATION_COLUMNS = 3;

export class WarMobilizationSystem {
  mobilize(declarations: DiplomacyDeclaration[], units: MobilizableUnit[]) {
    let mobilizedCount = 0;

    for (const declaration of declarations) {
      const factionOffsets = new Map<string, number>();
      const warFactions = new Set([declaration.firstFactionId, declaration.secondFactionId]);

      for (const unit of units) {
        if (unit.isDead || !warFactions.has(unit.factionId)) {
          continue;
        }

        const factionIndex = factionOffsets.get(unit.factionId) ?? 0;
        factionOffsets.set(unit.factionId, factionIndex + 1);

        const formationXOffset =
          unit.factionId === declaration.firstFactionId ? -UNIT_SPACING : UNIT_SPACING;
        const rank = Math.floor(factionIndex / FORMATION_COLUMNS);
        const file = (factionIndex % FORMATION_COLUMNS) - 1;

        unit.moveTo(
          declaration.rallyPoint.x + formationXOffset + rank * UNIT_SPACING,
          declaration.rallyPoint.y + file * UNIT_SPACING,
        );
        mobilizedCount += 1;
      }
    }

    return mobilizedCount;
  }
}
