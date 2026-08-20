import { type BuildingId, domainId, type LifeId, type SettlementId } from '../kernel/ids';
import type { HumanLifeFact, LifePopulationFacts } from '../life/lifeFacts';
import { planLandPath } from '../navigation/worldLandPath';
import type { NaturalResourceStore } from '../resources/naturalResources';
import { ElevationBand, elevationBandAt, type WorldFacts } from '../world/worldFacts';

export type SettlementResourceKind = 'food' | 'wood' | 'stone' | 'metal';
export type SettlementBuildingKind =
  | 'campfire'
  | 'tent'
  | 'basic-storage'
  | 'house'
  | 'farm'
  | 'logging-site'
  | 'mine'
  | 'workshop'
  | 'barracks'
  | 'village-center';

export interface SettlementInventoryFact {
  settlementId: SettlementId;
  food: number;
  wood: number;
  stone: number;
  metal: number;
  capacity: number;
}

export interface SettlementFact {
  id: SettlementId;
  name: string;
  founderLifeId: LifeId;
  centerCell: number;
  residentIds: LifeId[];
  foundedAtTick: number;
}

export interface SettlementBuildingFact {
  id: BuildingId;
  settlementId: SettlementId;
  kind: SettlementBuildingKind;
  cell: number;
  completed: boolean;
  progress: number;
  requiredProgress: number;
  required: Partial<Record<SettlementResourceKind, number>>;
  delivered: Partial<Record<SettlementResourceKind, number>>;
}

export interface LooseResourceFact {
  id: number;
  kind: SettlementResourceKind;
  amount: number;
  cell: number;
  source: 'harvest' | 'cancelled-construction' | 'dropped';
}

interface SettlementTaskOpportunityBase {
  id: number;
  settlementId: SettlementId;
  maxWorkers: number;
  createdAtTick: number;
}

export type SettlementTaskOpportunityFact =
  | (SettlementTaskOpportunityBase & {
      kind: 'gather-resource';
      resourceKind: SettlementResourceKind;
      shortage: number;
    })
  | (SettlementTaskOpportunityBase & {
      kind: 'haul-construction';
      resourceKind: SettlementResourceKind;
      shortage: number;
      buildingId: BuildingId;
    })
  | (SettlementTaskOpportunityBase & {
      kind: 'build';
      buildingId: BuildingId;
    });

export interface SettlementCivilizationFacts extends LifePopulationFacts {
  nextSettlementId: number;
  nextBuildingId: number;
  nextLooseResourceId: number;
  settlements: SettlementFact[];
  buildings: SettlementBuildingFact[];
  settlementInventories: SettlementInventoryFact[];
  looseResources: LooseResourceFact[];
  nextOpportunityId: number;
  opportunities: SettlementTaskOpportunityFact[];
}

export interface ReachableSettlement {
  settlement: SettlementFact;
  pathCells: number[];
}

export function findReachableSettlement(
  civilization: SettlementCivilizationFacts,
  human: HumanLifeFact,
  world: WorldFacts,
): ReachableSettlement | null {
  return (
    civilization.settlements
      .map((settlement) => ({
        settlement,
        pathCells: planLandPath(world, human.cell, settlement.centerCell),
      }))
      .filter((candidate) => candidate.pathCells.length > 0)
      .sort(
        (left, right) =>
          left.pathCells.length - right.pathCells.length ||
          left.settlement.id - right.settlement.id,
      )[0] ?? null
  );
}

export function joinSettlement(human: HumanLifeFact, settlement: SettlementFact): void {
  if (!settlement.residentIds.includes(human.id)) {
    settlement.residentIds.push(human.id);
    settlement.residentIds.sort((left, right) => left - right);
  }
  human.settlementId = settlement.id;
}

function facilityCells(
  world: WorldFacts,
  resources: NaturalResourceStore,
  buildings: readonly SettlementBuildingFact[],
  centerCell: number,
): number[] {
  const centerX = centerCell % world.size;
  const centerZ = Math.floor(centerCell / world.size);
  const occupied = new Set(buildings.map((building) => building.cell));
  const candidates: Array<{ cell: number; distance: number }> = [];
  for (let z = centerZ - 4; z <= centerZ + 4; z += 1) {
    for (let x = centerX - 4; x <= centerX + 4; x += 1) {
      if (x < 0 || z < 0 || x >= world.size || z >= world.size) continue;
      const cell = z * world.size + x;
      if (occupied.has(cell) || (resources.cellToResource[cell] ?? -1) >= 0) continue;
      if (elevationBandAt(world.elevation[cell] ?? -4) !== ElevationBand.Land) continue;
      candidates.push({ cell, distance: Math.abs(x - centerX) + Math.abs(z - centerZ) });
    }
  }
  return candidates
    .sort((left, right) => left.distance - right.distance || left.cell - right.cell)
    .slice(0, 3)
    .map((candidate) => candidate.cell);
}

export function establishPrimitiveSettlement(
  civilization: SettlementCivilizationFacts,
  world: WorldFacts,
  resources: NaturalResourceStore,
  founder: HumanLifeFact,
  tick: number,
): SettlementFact | null {
  if (findReachableSettlement(civilization, founder, world)) return null;
  const cells = facilityCells(world, resources, civilization.buildings, founder.cell);
  if (cells.length < 3) return null;
  const settlementId = domainId<'settlement'>(civilization.nextSettlementId);
  const settlement: SettlementFact = {
    id: settlementId,
    name: `聚落 ${civilization.nextSettlementId + 1}`,
    founderLifeId: founder.id,
    centerCell: founder.cell,
    residentIds: [founder.id],
    foundedAtTick: tick,
  };
  civilization.nextSettlementId += 1;
  civilization.settlements.push(settlement);
  civilization.settlementInventories.push({
    settlementId,
    food: 0,
    wood: 0,
    stone: 0,
    metal: 0,
    capacity: 80,
  });
  const kinds: SettlementBuildingKind[] = ['campfire', 'tent', 'basic-storage'];
  for (let index = 0; index < kinds.length; index += 1) {
    civilization.buildings.push({
      id: domainId<'building'>(civilization.nextBuildingId),
      settlementId,
      kind: kinds[index] ?? 'campfire',
      cell: cells[index] ?? founder.cell,
      completed: true,
      progress: 20,
      requiredProgress: 20,
      required: {},
      delivered: {},
    });
    civilization.nextBuildingId += 1;
  }
  founder.settlementId = settlementId;
  return settlement;
}
