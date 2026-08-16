import {
  DiplomacyState,
  EntityKind,
  type Kingdom,
  type KingdomLifeStatus,
  VillageTier,
  type WorldState,
} from '@/shared/gameTypes';
import { recordWorldEvent } from '../history/worldHistory';
import { POPULATION_BALANCE_RULES } from '../rules/populationRules';

const KINGDOM_NAMES = ['苍叶王国', '曦石同盟', '北风领', '金穗邦', '雾湾王国', '白峰城国'];
const KINGDOM_COLORS = ['#d66b52', '#5e8fd1', '#d0a84c', '#7baf65', '#9a72c7', '#4ca89c'];

export function formKingdoms(state: WorldState): void {
  for (const village of state.villages) {
    if (state.kingdoms.length >= 6) return;
    if (village.kingdomId !== 0 || village.tier < VillageTier.Hamlet || village.health <= 0)
      continue;
    const id = state.kingdoms.length + 1;
    const leaderId = findVillageLeader(state, village.id);
    const kingdom: Kingdom = {
      id,
      name: KINGDOM_NAMES[id - 1] ?? `王国 ${id}`,
      color: KINGDOM_COLORS[id - 1] ?? '#b3b3b3',
      leaderId,
      capitalVillageId: village.id,
      villageIds: [village.id],
      relations: {},
      militaryPower: 0,
      extinct: false,
      foundedAtTick: state.tick,
    };
    for (const other of state.kingdoms) {
      kingdom.relations[other.id] = DiplomacyState.Peace;
      other.relations[id] = DiplomacyState.Peace;
    }
    state.kingdoms.push(kingdom);
    village.kingdomId = id;
    for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
      if (state.entities.villageIds[entityId] === village.id)
        state.entities.kingdomIds[entityId] = id;
    }
    recordWorldEvent(state, {
      kind: 'kingdom-founded',
      category: 'kingdom',
      message: `${kingdom.name}在${village.name}建立`,
      archive: true,
      notification: true,
      entityIds: [leaderId],
      villageIds: [village.id],
      kingdomIds: [kingdom.id],
      locationCell: Math.floor(village.z) * state.map.size + Math.floor(village.x),
    });
  }
}

function findVillageLeader(state: WorldState, villageId: number): number {
  let leader = 0;
  let oldest = -1;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (state.entities.villageIds[entityId] !== villageId || !state.entities.active[entityId])
      continue;
    if ((state.entities.age[entityId] ?? 0) > oldest) {
      oldest = state.entities.age[entityId] ?? 0;
      leader = entityId;
    }
  }
  return leader;
}

export function setDiplomacy(
  state: WorldState,
  firstId: number,
  secondId: number,
  relation: DiplomacyState,
): void {
  const first = state.kingdoms.find((kingdom) => kingdom.id === firstId && !kingdom.extinct);
  const second = state.kingdoms.find((kingdom) => kingdom.id === secondId && !kingdom.extinct);
  if (!first || !second || first.id === second.id) return;
  first.relations[second.id] = relation;
  second.relations[first.id] = relation;
}

export function resolveKingdomExtinctions(state: WorldState): void {
  for (const kingdom of state.kingdoms) {
    refreshKingdomCapital(state, kingdom);
    if (kingdom.extinct) continue;
    for (const villageId of kingdom.villageIds) {
      const village = state.villages.find((candidate) => candidate.id === villageId);
      if (!village || countLivingVillageCitizens(state, kingdom.id, villageId) > 0) continue;
      if (village.abandonedAtTick === 0) village.abandonedAtTick = Math.max(1, state.tick);
    }
    if (kingdomLifeStatus(state, kingdom) !== 'extinct') continue;
    kingdom.extinct = true;
    kingdom.capitalVillageId = 0;
    kingdom.militaryPower = 0;
    for (const other of state.kingdoms) {
      if (other.id === kingdom.id) continue;
      kingdom.relations[other.id] = DiplomacyState.Peace;
      other.relations[kingdom.id] = DiplomacyState.Peace;
    }
    recordWorldEvent(state, {
      kind: 'kingdom-extinct',
      category: 'kingdom',
      message: `${kingdom.name}灭亡`,
      archive: true,
      notification: true,
      kingdomIds: [kingdom.id],
    });
  }
}

function isLivingKingdomCitizen(state: WorldState, entityId: number, kingdomId: number): boolean {
  return (
    state.entities.active[entityId] === 1 &&
    (state.entities.health[entityId] ?? 0) > 0 &&
    state.entities.kind[entityId] === EntityKind.Human &&
    state.entities.kingdomIds[entityId] === kingdomId
  );
}

export function livingKingdomCitizenIds(state: WorldState, kingdomId: number): number[] {
  const citizens: number[] = [];
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (isLivingKingdomCitizen(state, entityId, kingdomId)) citizens.push(entityId);
  }
  return citizens;
}

function countLivingVillageCitizens(
  state: WorldState,
  kingdomId: number,
  villageId: number,
): number {
  let count = 0;
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (
      isLivingKingdomCitizen(state, entityId, kingdomId) &&
      state.entities.villageIds[entityId] === villageId
    ) {
      count += 1;
    }
  }
  return count;
}

export function kingdomLifeStatus(state: WorldState, kingdom: Kingdom): KingdomLifeStatus {
  const citizens = livingKingdomCitizenIds(state, kingdom.id);
  if (citizens.length === 0) return 'extinct';
  const hasPopulatedSettlement = kingdom.villageIds.some(
    (villageId) => countLivingVillageCitizens(state, kingdom.id, villageId) > 0,
  );
  if (!hasPopulatedSettlement) return 'exiled';
  if (citizens.length < POPULATION_BALANCE_RULES.minimumViableVillagePopulation)
    return 'endangered';
  return 'active';
}

export function refreshKingdomCapital(state: WorldState, kingdom: Kingdom): void {
  if (kingdom.extinct) {
    kingdom.capitalVillageId = 0;
    return;
  }
  const current = state.villages.find(
    (village) =>
      village.id === kingdom.capitalVillageId &&
      kingdom.villageIds.includes(village.id) &&
      village.health > 0 &&
      countLivingVillageCitizens(state, kingdom.id, village.id) > 0,
  );
  if (current) return;
  const candidates = state.villages
    .filter(
      (village) =>
        kingdom.villageIds.includes(village.id) &&
        village.health > 0 &&
        countLivingVillageCitizens(state, kingdom.id, village.id) > 0,
    )
    .sort((first, second) => {
      const firstBuildings = first.buildingIds.filter((buildingId) => {
        const building = state.buildings[buildingId - 1];
        return building?.completed && building.health > 0;
      }).length;
      const secondBuildings = second.buildingIds.filter((buildingId) => {
        const building = state.buildings[buildingId - 1];
        return building?.completed && building.health > 0;
      }).length;
      return (
        second.tier - first.tier ||
        second.population - first.population ||
        secondBuildings - firstBuildings ||
        first.foundedAtTick - second.foundedAtTick ||
        first.id - second.id
      );
    });
  kingdom.capitalVillageId = candidates[0]?.id ?? 0;
}

export function activeWars(state: WorldState): number {
  let wars = 0;
  for (const kingdom of state.kingdoms) {
    if (kingdom.extinct) continue;
    for (const [otherId, relation] of Object.entries(kingdom.relations)) {
      if (Number(otherId) > kingdom.id && relation === DiplomacyState.War) wars += 1;
    }
  }
  return wars;
}
