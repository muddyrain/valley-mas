import { domainId, type FamilyId, type LifeId, type SettlementId } from '../kernel/ids';
import { settlementHousingCapacity } from '../settlements/construction';
import type { SettlementCivilizationFacts } from '../settlements/settlementFacts';
import { createChildLifeFact } from './lifeFacts';

export interface FamilyFact {
  id: FamilyId;
  settlementId: SettlementId;
  partnerIds: [LifeId, LifeId];
  childIds: LifeId[];
  formedAtTick: number;
  lastBirthAtTick: number;
}

export interface FamilyCivilizationFacts extends SettlementCivilizationFacts {
  nextFamilyId: number;
  families: FamilyFact[];
}

export function formSettlementFamilies(civilization: FamilyCivilizationFacts, tick: number): void {
  if (tick % 100 !== 0) return;
  for (const settlement of civilization.settlements) {
    const eligible = civilization.life.filter(
      (human) =>
        human.active &&
        human.settlementId === settlement.id &&
        human.ageYears >= 18 &&
        human.partnerId === null,
    );
    const females = eligible
      .filter((human) => human.sex === 'female')
      .sort((left, right) => left.id - right.id);
    const males = eligible
      .filter((human) => human.sex === 'male')
      .sort((left, right) => left.id - right.id);
    const pairCount = Math.min(females.length, males.length);
    for (let index = 0; index < pairCount; index += 1) {
      const first = females[index];
      const second = males[index];
      if (!first || !second) continue;
      const familyId = domainId<'family'>(civilization.nextFamilyId);
      civilization.nextFamilyId += 1;
      first.partnerId = second.id;
      second.partnerId = first.id;
      first.familyId = familyId;
      second.familyId = familyId;
      civilization.families.push({
        id: familyId,
        settlementId: settlement.id,
        partnerIds: [first.id, second.id],
        childIds: [],
        formedAtTick: tick,
        lastBirthAtTick: -1,
      });
    }
  }
}

export function advanceFamilyReproduction(
  civilization: FamilyCivilizationFacts,
  seed: string,
  tick: number,
): void {
  if (tick < 400 || tick % 400 !== 0) return;
  for (const family of civilization.families) {
    if (family.lastBirthAtTick >= 0 && tick - family.lastBirthAtTick < 2_400) continue;
    const settlement = civilization.settlements.find(
      (candidate) => candidate.id === family.settlementId,
    );
    const inventory = civilization.settlementInventories.find(
      (candidate) => candidate.settlementId === family.settlementId,
    );
    const parents = family.partnerIds.map((parentId) =>
      civilization.life.find((human) => human.id === parentId && human.active),
    );
    const mother = parents.find((parent) => parent?.sex === 'female');
    if (!settlement || !inventory || !parents[0] || !parents[1] || !mother) continue;
    if (mother.ageYears > 45 || inventory.food < settlement.residentIds.length * 2) continue;
    if (
      settlementHousingCapacity(civilization.buildings, settlement.id) <=
      settlement.residentIds.length
    ) {
      continue;
    }
    const child = createChildLifeFact(
      civilization,
      seed,
      mother.cell,
      settlement.id,
      family.id,
      family.partnerIds,
    );
    family.childIds.push(child.id);
    family.lastBirthAtTick = tick;
    settlement.residentIds.push(child.id);
    settlement.residentIds.sort((left, right) => left - right);
  }
}
