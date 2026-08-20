import { domainId } from '../kernel/ids';
import type { NaturalResourceStore } from '../resources/naturalResources';
import { ElevationBand, elevationBandAt, type WorldFacts } from '../world/worldFacts';
import type {
  SettlementBuildingFact,
  SettlementBuildingKind,
  SettlementCivilizationFacts,
  SettlementFact,
  SettlementResourceKind,
} from './settlementFacts';

interface BuildingProfile {
  requiredProgress: number;
  required: Partial<Record<SettlementResourceKind, number>>;
}

export const BUILDING_PROFILES: Record<SettlementBuildingKind, BuildingProfile> = {
  campfire: { requiredProgress: 20, required: {} },
  tent: { requiredProgress: 20, required: {} },
  'basic-storage': { requiredProgress: 20, required: {} },
  house: { requiredProgress: 30, required: { wood: 4, stone: 1 } },
  farm: { requiredProgress: 28, required: { wood: 3 } },
  'logging-site': { requiredProgress: 24, required: { wood: 2 } },
  mine: { requiredProgress: 30, required: { wood: 3, stone: 2 } },
  workshop: { requiredProgress: 40, required: { wood: 5, stone: 3, metal: 1 } },
  barracks: { requiredProgress: 48, required: { wood: 6, stone: 5, metal: 2 } },
  'village-center': { requiredProgress: 44, required: { wood: 6, stone: 4 } },
};

export interface SettlementCapabilities {
  housingCapacity: number;
  storageCapacity: number;
  farmingSlots: number;
  loggingSlots: number;
  miningSlots: number;
  craftingSlots: number;
  trainingSlots: number;
  hasCampfire: boolean;
  hasCivicCenter: boolean;
}

export function deriveSettlementCapabilities(
  buildings: readonly SettlementBuildingFact[],
  settlementId: number,
): SettlementCapabilities {
  const completed = buildings.filter(
    (building) => building.settlementId === settlementId && building.completed,
  );
  const count = (kind: SettlementBuildingKind) =>
    completed.reduce((total, building) => total + (building.kind === kind ? 1 : 0), 0);
  return {
    housingCapacity: count('tent') * 2 + count('house') * 4,
    storageCapacity: count('basic-storage') * 80,
    farmingSlots: count('farm') * 2,
    loggingSlots: count('logging-site') * 2,
    miningSlots: count('mine') * 2,
    craftingSlots: count('workshop') * 2,
    trainingSlots: count('barracks') * 4,
    hasCampfire: count('campfire') > 0,
    hasCivicCenter: count('village-center') > 0,
  };
}

export function settlementHousingCapacity(
  buildings: readonly SettlementBuildingFact[],
  settlementId: number,
): number {
  return buildings.reduce((capacity, building) => {
    if (!building.completed || building.settlementId !== settlementId) return capacity;
    if (building.kind === 'tent') return capacity + 2;
    if (building.kind === 'house') return capacity + 4;
    return capacity;
  }, 0);
}

function nextBuildingKind(
  civilization: SettlementCivilizationFacts,
  settlement: SettlementFact,
): SettlementBuildingKind | null {
  const completedKinds = new Set(
    civilization.buildings
      .filter((building) => building.settlementId === settlement.id && building.completed)
      .map((building) => building.kind),
  );
  if (
    settlementHousingCapacity(civilization.buildings, settlement.id) < settlement.residentIds.length
  )
    return 'house';
  const ordered: SettlementBuildingKind[] = [
    'farm',
    'logging-site',
    'mine',
    'workshop',
    'village-center',
    'barracks',
  ];
  return (
    ordered.find(
      (kind) =>
        !completedKinds.has(kind) && (kind !== 'barracks' || settlement.residentIds.length >= 12),
    ) ?? null
  );
}

function selectSite(
  world: WorldFacts,
  resources: NaturalResourceStore,
  buildings: readonly SettlementBuildingFact[],
  centerCell: number,
): number | null {
  const centerX = centerCell % world.size;
  const centerZ = Math.floor(centerCell / world.size);
  const occupied = new Set(buildings.map((building) => building.cell));
  const candidates: Array<{ cell: number; distance: number }> = [];
  for (let radius = 2; radius <= 8; radius += 1) {
    for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
      for (let x = centerX - radius; x <= centerX + radius; x += 1) {
        if (Math.max(Math.abs(x - centerX), Math.abs(z - centerZ)) !== radius) continue;
        if (x < 0 || z < 0 || x >= world.size || z >= world.size) continue;
        const cell = z * world.size + x;
        if (occupied.has(cell) || (resources.cellToResource[cell] ?? -1) >= 0) continue;
        if (elevationBandAt(world.elevation[cell] ?? -4) !== ElevationBand.Land) continue;
        candidates.push({ cell, distance: Math.abs(x - centerX) + Math.abs(z - centerZ) });
      }
    }
    if (candidates.length > 0) break;
  }
  return (
    candidates.sort((left, right) => left.distance - right.distance || left.cell - right.cell)[0]
      ?.cell ?? null
  );
}

export function planConstructionProjects(
  civilization: SettlementCivilizationFacts,
  world: WorldFacts,
  resources: NaturalResourceStore,
  tick: number,
): void {
  if (tick % 20 !== 0) return;
  for (const settlement of civilization.settlements) {
    if (
      civilization.buildings.some(
        (building) => building.settlementId === settlement.id && !building.completed,
      )
    ) {
      continue;
    }
    const kind = nextBuildingKind(civilization, settlement);
    if (!kind) continue;
    const cell = selectSite(world, resources, civilization.buildings, settlement.centerCell);
    if (cell === null) continue;
    const profile = BUILDING_PROFILES[kind];
    civilization.buildings.push({
      id: domainId<'building'>(civilization.nextBuildingId),
      settlementId: settlement.id,
      kind,
      cell,
      completed: false,
      progress: 0,
      requiredProgress: profile.requiredProgress,
      required: { ...profile.required },
      delivered: {},
    });
    civilization.nextBuildingId += 1;
  }
}
