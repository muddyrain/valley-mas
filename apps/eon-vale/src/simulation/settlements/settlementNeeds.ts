import type { HumanLifeFact } from '../life/lifeFacts';
import type {
  SettlementCivilizationFacts,
  SettlementResourceKind,
  SettlementTaskOpportunityFact,
} from './settlementFacts';

const RESOURCE_ORDER: SettlementResourceKind[] = ['food', 'wood', 'stone', 'metal'];

function targetStock(resourceKind: SettlementResourceKind, population: number): number {
  if (resourceKind === 'food') return Math.max(3, population * 3);
  if (resourceKind === 'wood') return 12;
  if (resourceKind === 'stone') return 8;
  return 4;
}

function committedAmount(
  humans: readonly HumanLifeFact[],
  settlementId: number,
  resourceKind: SettlementResourceKind,
): number {
  let amount = 0;
  for (const human of humans) {
    if (human.settlementId !== settlementId) continue;
    if (human.carried.kind === resourceKind) amount += human.carried.amount;
    if (
      human.task?.kind === 'gather-resource' &&
      human.task.resourceKind === resourceKind &&
      human.carried.amount === 0
    ) {
      amount += 1;
    }
  }
  return amount;
}

export function planSettlementNeeds(civilization: SettlementCivilizationFacts, tick: number): void {
  if (tick % 20 !== 0) return;
  const constructionOpportunities: SettlementTaskOpportunityFact[] = [];
  const gatheringOpportunities: SettlementTaskOpportunityFact[] = [];
  for (const settlement of civilization.settlements) {
    const inventory = civilization.settlementInventories.find(
      (candidate) => candidate.settlementId === settlement.id,
    );
    if (!inventory) continue;
    const project = civilization.buildings.find(
      (building) => building.settlementId === settlement.id && !building.completed,
    );
    if (project) {
      let materialsReady = true;
      for (const resourceKind of RESOURCE_ORDER) {
        const required = project.required[resourceKind] ?? 0;
        const delivered = project.delivered[resourceKind] ?? 0;
        const committed = civilization.life.reduce(
          (total, human) =>
            total +
            (human.task?.kind === 'deliver-resource' &&
            human.task.targetBuildingId === project.id &&
            human.task.resourceKind === resourceKind
              ? 1
              : 0),
          0,
        );
        const missing = Math.max(0, required - delivered - committed);
        if (missing <= 0) continue;
        materialsReady = false;
        if (inventory[resourceKind] <= 0) continue;
        constructionOpportunities.push({
          id: civilization.nextOpportunityId,
          settlementId: settlement.id,
          kind: 'haul-construction',
          buildingId: project.id,
          resourceKind,
          shortage: missing,
          maxWorkers: Math.min(missing, settlement.residentIds.length),
          createdAtTick: tick,
        });
        civilization.nextOpportunityId += 1;
      }
      if (materialsReady) {
        constructionOpportunities.push({
          id: civilization.nextOpportunityId,
          settlementId: settlement.id,
          kind: 'build',
          buildingId: project.id,
          maxWorkers: 1,
          createdAtTick: tick,
        });
        civilization.nextOpportunityId += 1;
      }
    }
    for (const resourceKind of RESOURCE_ORDER) {
      const available = inventory[resourceKind];
      const committed = committedAmount(civilization.life, settlement.id, resourceKind);
      const shortage = Math.max(
        0,
        targetStock(resourceKind, settlement.residentIds.length) - available - committed,
      );
      if (shortage === 0) continue;
      gatheringOpportunities.push({
        id: civilization.nextOpportunityId,
        settlementId: settlement.id,
        kind: 'gather-resource',
        resourceKind,
        shortage,
        maxWorkers: Math.max(1, Math.min(settlement.residentIds.length, Math.ceil(shortage / 2))),
        createdAtTick: tick,
      });
      civilization.nextOpportunityId += 1;
    }
  }
  civilization.opportunities = [...constructionOpportunities, ...gatheringOpportunities];
  for (const human of civilization.life) {
    if (!human.active || human.settlementId === null || human.task) continue;
    if (human.nutritionStage !== 'healthy' || human.energyStage !== 'rested') continue;
    human.decisionRequested = true;
  }
}

export function selectSettlementWorkIntents(
  civilization: SettlementCivilizationFacts,
  tick: number,
): void {
  const assigned = new Map<number, number>();
  for (const human of civilization.life) {
    const opportunityId = human.intent.opportunityId;
    if (human.task || opportunityId === undefined) continue;
    assigned.set(opportunityId, (assigned.get(opportunityId) ?? 0) + 1);
  }
  for (const human of civilization.life) {
    if (
      !human.active ||
      human.ageYears < 16 ||
      human.task ||
      human.settlementId === null ||
      human.intent.kind !== 'idle' ||
      human.nutritionStage !== 'healthy' ||
      human.energyStage !== 'rested'
    ) {
      continue;
    }
    const opportunity = civilization.opportunities.find(
      (candidate) =>
        candidate.settlementId === human.settlementId &&
        (assigned.get(candidate.id) ?? 0) < candidate.maxWorkers,
    );
    if (!opportunity) continue;
    human.intent = {
      kind: 'settlement-work',
      reason: 'settlement-net-deficit',
      selectedTick: tick,
      opportunityId: opportunity.id,
    };
    assigned.set(opportunity.id, (assigned.get(opportunity.id) ?? 0) + 1);
  }
}
