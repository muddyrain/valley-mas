import {
  CarriedResourceKind,
  ResourceNodeKind,
  type Village,
  type WorldState,
} from '@/shared/gameTypes';
import { harvestResourceNode } from './resourceNodes';

const CARRY_CAPACITY = 3;

function carriedKindForNode(kind: ResourceNodeKind): CarriedResourceKind {
  if (kind === ResourceNodeKind.Tree) return CarriedResourceKind.Wood;
  if (kind === ResourceNodeKind.Stone) return CarriedResourceKind.Stone;
  return CarriedResourceKind.Metal;
}

export function villageNeedsResource(village: Village, kind: ResourceNodeKind): boolean {
  if (kind === ResourceNodeKind.Tree) {
    return village.resources.wood < 48 + village.population * 5;
  }
  if (kind === ResourceNodeKind.Stone) {
    return village.resources.stone < 32 + village.population * 3;
  }
  return village.resources.metal < 12 + village.population;
}

export function collectResourceForCarrier(
  state: WorldState,
  entityId: number,
  nodeId: number,
  tick = state.tick,
): number {
  if (!state.entities.active[entityId]) return 0;
  const nodeKind = state.resourceNodes.kind[nodeId] as ResourceNodeKind;
  const carriedKind = carriedKindForNode(nodeKind);
  const currentKind = state.entities.carriedResourceKinds[entityId] as CarriedResourceKind;
  const currentAmount = state.entities.carriedResources[entityId] ?? 0;
  if (currentAmount > 0 && currentKind !== carriedKind) return 0;
  const remainingCapacity = Math.max(0, CARRY_CAPACITY - currentAmount);
  if (remainingCapacity === 0) return 0;
  const harvested = harvestResourceNode(
    state.resourceNodes,
    nodeId,
    tick,
    remainingCapacity,
  ).amount;
  if (harvested === 0) return 0;
  state.entities.carriedResourceKinds[entityId] = carriedKind;
  state.entities.carriedResources[entityId] = currentAmount + harvested;
  return harvested;
}

export function depositCarriedResource(state: WorldState, entityId: number): number {
  const amount = state.entities.carriedResources[entityId] ?? 0;
  if (amount === 0) return 0;
  const village = state.villages.find(
    (candidate) => candidate.id === state.entities.villageIds[entityId],
  );
  if (!village) return 0;
  const kind = state.entities.carriedResourceKinds[entityId] as CarriedResourceKind;
  if (kind === CarriedResourceKind.Wood) village.resources.wood += amount;
  else if (kind === CarriedResourceKind.Stone) village.resources.stone += amount;
  else if (kind === CarriedResourceKind.Metal) village.resources.metal += amount;
  else return 0;
  state.entities.carriedResources[entityId] = 0;
  state.entities.carriedResourceKinds[entityId] = CarriedResourceKind.None;
  return amount;
}
