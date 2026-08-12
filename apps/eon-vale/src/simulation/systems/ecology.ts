import {
  type AnimalDeathCause,
  type AnimalDeathCauseCounts,
  type AnimalEcologyStatus,
  type EcologyDiagnostics,
  EntityKind,
  TerrainType,
  type WorldState,
} from '@/shared/gameTypes';

export const ANIMAL_SPECIES = [
  EntityKind.Chicken,
  EntityKind.Sheep,
  EntityKind.Cow,
  EntityKind.Deer,
  EntityKind.Wolf,
  EntityKind.Bear,
  EntityKind.Fish,
] as const;

export const ANIMAL_SPECIES_NAMES: Record<(typeof ANIMAL_SPECIES)[number], string> = {
  [EntityKind.Chicken]: '鸡',
  [EntityKind.Sheep]: '羊',
  [EntityKind.Cow]: '牛',
  [EntityKind.Deer]: '鹿',
  [EntityKind.Wolf]: '狼',
  [EntityKind.Bear]: '熊',
  [EntityKind.Fish]: '鱼',
};

const HABITATS: Record<(typeof ANIMAL_SPECIES)[number], readonly TerrainType[]> = {
  [EntityKind.Chicken]: [TerrainType.Grass],
  [EntityKind.Sheep]: [TerrainType.Grass],
  [EntityKind.Cow]: [TerrainType.Grass],
  [EntityKind.Deer]: [TerrainType.Grass, TerrainType.Forest],
  [EntityKind.Wolf]: [TerrainType.Forest, TerrainType.Snow],
  [EntityKind.Bear]: [TerrainType.Forest, TerrainType.Snow, TerrainType.Mountain],
  [EntityKind.Fish]: [TerrainType.Ocean, TerrainType.ShallowOcean],
};

export function emptyAnimalDeathCauses(): AnimalDeathCauseCounts {
  return {
    age: 0,
    hunger: 0,
    predation: 0,
    hunting: 0,
    disease: 0,
    disaster: 0,
  };
}

export function speciesHabitats(kind: EntityKind): readonly TerrainType[] {
  return HABITATS[kind as (typeof ANIMAL_SPECIES)[number]] ?? [];
}

export function speciesReturnGroup(kind: EntityKind): readonly [number, number] {
  if (kind === EntityKind.Fish) return [3, 6];
  if (kind === EntityKind.Wolf || kind === EntityKind.Bear) return [1, 2];
  return [2, 4];
}

export function createEcologyDiagnostics(): EcologyDiagnostics {
  return {
    animals: 0,
    species: Array.from({ length: EntityKind.Fish + 1 }, (_, kind) => ({
      kind: kind as EntityKind,
      count: 0,
      capacity: 0,
      status: 'not-introduced' as AnimalEcologyStatus,
      everPresent: false,
      lastReturnTick: 0,
      births: 0,
      deaths: 0,
      deathCauses: emptyAnimalDeathCauses(),
    })),
    nextReturnTicks: Array.from({ length: EntityKind.Fish + 1 }, () => 0),
    extinctSinceTicks: Array.from({ length: EntityKind.Fish + 1 }, () => 0),
  };
}

export function recordAnimalBirth(state: WorldState, kind: EntityKind): void {
  const diagnostics = state.ecology.species[kind];
  if (!diagnostics) return;
  diagnostics.births += 1;
}

export function recordAnimalDeath(
  state: WorldState,
  entityId: number,
  cause: AnimalDeathCause,
): void {
  if (!state.entities.active[entityId]) return;
  const kind = state.entities.kind[entityId] as EntityKind;
  if (kind === EntityKind.Human) return;
  state.entities.active[entityId] = 0;
  state.entities.paths[entityId] = null;
  const diagnostics = state.ecology.species[kind];
  if (!diagnostics) return;
  diagnostics.deaths += 1;
  diagnostics.deathCauses[cause] += 1;
}

export function habitatCells(state: WorldState, kind: EntityKind): number[] {
  const accepted = speciesHabitats(kind);
  const result: number[] = [];
  for (let cell = 0; cell < state.map.terrain.length; cell += 1) {
    if (accepted.includes(state.map.terrain[cell] as TerrainType)) result.push(cell);
  }
  return result;
}

export function speciesCapacity(state: WorldState, kind: EntityKind): number {
  const habitatCount = habitatCells(state, kind).length;
  if (habitatCount === 0) return 0;
  const hardCap =
    kind === EntityKind.Fish ? 64 : kind === EntityKind.Wolf || kind === EntityKind.Bear ? 18 : 48;
  const density = kind === EntityKind.Wolf || kind === EntityKind.Bear ? 420 : 180;
  return Math.min(hardCap, Math.max(1, Math.floor(habitatCount / density)));
}

export function refreshEcologyDiagnostics(state: WorldState): void {
  const counts = Array.from({ length: EntityKind.Fish + 1 }, () => 0);
  for (let entityId = 0; entityId < state.entities.count; entityId += 1) {
    if (!state.entities.active[entityId]) continue;
    const kind = state.entities.kind[entityId] as EntityKind;
    if (kind !== EntityKind.Human) counts[kind] = (counts[kind] ?? 0) + 1;
  }
  state.ecology.animals = ANIMAL_SPECIES.reduce((sum, kind) => sum + (counts[kind] ?? 0), 0);
  for (const kind of ANIMAL_SPECIES) {
    const diagnostics = state.ecology.species[kind];
    if (!diagnostics) continue;
    const count = counts[kind] ?? 0;
    const capacity = speciesCapacity(state, kind);
    diagnostics.count = count;
    diagnostics.capacity = capacity;
    if (count > 0) {
      diagnostics.everPresent = true;
      state.ecology.extinctSinceTicks[kind] = 0;
    } else if (diagnostics.everPresent && !state.ecology.extinctSinceTicks[kind]) {
      state.ecology.extinctSinceTicks[kind] = state.tick;
    }

    if (!diagnostics.everPresent) diagnostics.status = 'not-introduced';
    else if (count === 0 && capacity === 0) diagnostics.status = 'waiting-habitat';
    else if (count === 0 && state.tick < (state.ecology.nextReturnTicks[kind] ?? 0))
      diagnostics.status = 'return-cooldown';
    else if (count === 0) diagnostics.status = 'extinct';
    else if (diagnostics.lastReturnTick > 0 && state.tick - diagnostics.lastReturnTick < 720)
      diagnostics.status = 'returning';
    else if (count <= Math.max(2, Math.ceil(capacity * 0.2))) diagnostics.status = 'endangered';
    else diagnostics.status = 'stable';
  }
}
