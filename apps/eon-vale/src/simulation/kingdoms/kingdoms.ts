import { DiplomacyState, type Kingdom, VillageTier, type WorldState } from '@/shared/gameTypes';

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
    const alive = kingdom.villageIds.some((villageId) => {
      const village = state.villages.find((candidate) => candidate.id === villageId);
      return village && village.health > 0;
    });
    if (alive) continue;
    kingdom.extinct = true;
    kingdom.capitalVillageId = 0;
    kingdom.militaryPower = 0;
    for (const other of state.kingdoms)
      setDiplomacy(state, kingdom.id, other.id, DiplomacyState.Peace);
  }
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
      village.health > 0,
  );
  if (current) return;
  const candidates = state.villages
    .filter((village) => kingdom.villageIds.includes(village.id) && village.health > 0)
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
