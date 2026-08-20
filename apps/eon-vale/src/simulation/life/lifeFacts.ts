import { domainId, type FamilyId, type LifeId, type SettlementId } from '../kernel/ids';
import type { HumanTaskFact, HumanTaskFailureFact } from '../tasks/taskFacts';
import { ElevationBand, elevationBandAt, type WorldFacts } from '../world/worldFacts';

export type NutritionStage = 'healthy' | 'hungry' | 'starving';
export type EnergyStage = 'rested' | 'tired' | 'exhausted';
export type HumanIntentKind =
  | 'establish-settlement'
  | 'find-food'
  | 'eat'
  | 'rest'
  | 'settlement-work'
  | 'idle';

export interface HumanPerceptionFacts {
  observedAtTick: number;
  nearestFoodResourceId: number | null;
  nearestFoodDistance: number | null;
}

export interface HumanIntentFact {
  kind: HumanIntentKind;
  reason:
    | 'newly-created'
    | 'unsettled-adult'
    | 'nutrition-critical'
    | 'energy-critical'
    | 'settlement-net-deficit'
    | 'no-urgent-need';
  selectedTick: number;
  opportunityId?: number;
}

export interface HumanLifeFact {
  id: LifeId;
  active: boolean;
  name: string;
  cell: number;
  ageYears: number;
  sex: 'female' | 'male';
  health: number;
  nutrition: number;
  energy: number;
  nutritionStage: NutritionStage;
  energyStage: EnergyStage;
  settlementId: number | null;
  familyId: FamilyId | null;
  partnerId: LifeId | null;
  parentIds: [LifeId | null, LifeId | null];
  perception: HumanPerceptionFacts;
  intent: HumanIntentFact;
  decisionRequested: boolean;
  task: HumanTaskFact | null;
  suspendedTask: HumanTaskFact | null;
  lastTaskFailure: HumanTaskFailureFact | null;
  retryAfterTick: number;
  workRole: 'none' | 'forager' | 'woodcutter' | 'miner' | 'builder' | 'hauler';
  carried: { kind: 'food' | 'wood' | 'stone' | 'metal' | null; amount: number };
  lastMealAtTick: number;
}

export interface LifePopulationFacts {
  humans: number;
  nextLifeId: number;
  nextTaskId: number;
  life: HumanLifeFact[];
}

export function nutritionStageAt(previous: NutritionStage, nutrition: number): NutritionStage {
  if (previous === 'healthy') return nutrition <= 600 ? 'hungry' : 'healthy';
  if (previous === 'hungry') {
    if (nutrition <= 250) return 'starving';
    return nutrition >= 700 ? 'healthy' : 'hungry';
  }
  return nutrition >= 350 ? 'hungry' : 'starving';
}

export function energyStageAt(previous: EnergyStage, energy: number): EnergyStage {
  if (previous === 'rested') return energy <= 500 ? 'tired' : 'rested';
  if (previous === 'tired') {
    if (energy <= 150) return 'exhausted';
    return energy >= 650 ? 'rested' : 'tired';
  }
  return energy >= 250 ? 'tired' : 'exhausted';
}

export function advanceLifeBodies(population: LifePopulationFacts, tick: number): void {
  const spendsNutrition = tick % 20 === 0;
  const spendsEnergy = tick % 10 === 0;
  for (const human of population.life) {
    if (!human.active) continue;
    const previousNutritionStage = human.nutritionStage;
    const previousEnergyStage = human.energyStage;
    if (spendsNutrition) human.nutrition = Math.max(0, human.nutrition - 1);
    if (spendsEnergy) human.energy = Math.max(0, human.energy - 1);
    human.nutritionStage = nutritionStageAt(human.nutritionStage, human.nutrition);
    human.energyStage = energyStageAt(human.energyStage, human.energy);
    if (
      previousNutritionStage !== human.nutritionStage ||
      previousEnergyStage !== human.energyStage
    ) {
      human.decisionRequested = true;
    }
    if (human.nutrition === 0 && tick % 20 === 0) human.health = Math.max(0, human.health - 1);
    if (human.health === 0) human.active = false;
  }
  population.humans = population.life.reduce((total, human) => total + (human.active ? 1 : 0), 0);
}

function humanName(seed: string, id: number): string {
  const syllables = ['Ael', 'Bryn', 'Cora', 'Dain', 'Eira', 'Finn', 'Galen', 'Hale'];
  let hash = 2_166_136_261;
  for (const character of `${seed}:${id}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${syllables[(hash >>> 0) % syllables.length]}-${id + 1}`;
}

export function deterministicHumanPlacementCells(
  world: WorldFacts,
  centerCell: number,
  count: number,
): number[] {
  const centerX = centerCell % world.size;
  const centerZ = Math.floor(centerCell / world.size);
  const cells: number[] = [];
  for (let radius = 0; radius < world.size && cells.length < count; radius += 1) {
    for (let offsetZ = -radius; offsetZ <= radius && cells.length < count; offsetZ += 1) {
      for (let offsetX = -radius; offsetX <= radius && cells.length < count; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetZ)) !== radius) continue;
        const x = centerX + offsetX;
        const z = centerZ + offsetZ;
        if (x < 0 || z < 0 || x >= world.size || z >= world.size) continue;
        const cell = z * world.size + x;
        if (elevationBandAt(world.elevation[cell] ?? -4) === ElevationBand.Land) cells.push(cell);
      }
    }
  }
  return cells;
}

export function placeHumanFacts(
  population: LifePopulationFacts,
  seed: string,
  cells: readonly number[],
): HumanLifeFact[] {
  const created: HumanLifeFact[] = [];
  for (let index = 0; index < cells.length; index += 1) {
    const numericId = population.nextLifeId;
    const human: HumanLifeFact = {
      id: domainId<'life'>(numericId),
      active: true,
      name: humanName(seed, numericId),
      cell: cells[index] ?? 0,
      ageYears: 18 + ((numericId * 5 + index) % 6),
      sex: numericId % 2 === 0 ? 'female' : 'male',
      health: 1_000,
      nutrition: 1_000,
      energy: 1_000,
      nutritionStage: 'healthy',
      energyStage: 'rested',
      settlementId: null,
      familyId: null,
      partnerId: null,
      parentIds: [null, null],
      perception: {
        observedAtTick: -1,
        nearestFoodResourceId: null,
        nearestFoodDistance: null,
      },
      intent: { kind: 'idle', reason: 'newly-created', selectedTick: 0 },
      decisionRequested: true,
      task: null,
      suspendedTask: null,
      lastTaskFailure: null,
      retryAfterTick: 0,
      workRole: 'none',
      carried: { kind: null, amount: 0 },
      lastMealAtTick: -1,
    };
    population.nextLifeId += 1;
    population.life.push(human);
    created.push(human);
  }
  population.humans = population.life.reduce((total, human) => total + (human.active ? 1 : 0), 0);
  return created;
}

export function createChildLifeFact(
  population: LifePopulationFacts,
  seed: string,
  cell: number,
  settlementId: SettlementId,
  familyId: FamilyId,
  parentIds: [LifeId, LifeId],
): HumanLifeFact {
  const numericId = population.nextLifeId;
  const child: HumanLifeFact = {
    id: domainId<'life'>(numericId),
    active: true,
    name: humanName(seed, numericId),
    cell,
    ageYears: 0,
    sex: numericId % 2 === 0 ? 'female' : 'male',
    health: 1_000,
    nutrition: 900,
    energy: 900,
    nutritionStage: 'healthy',
    energyStage: 'rested',
    settlementId,
    familyId,
    partnerId: null,
    parentIds,
    perception: {
      observedAtTick: -1,
      nearestFoodResourceId: null,
      nearestFoodDistance: null,
    },
    intent: { kind: 'idle', reason: 'newly-created', selectedTick: 0 },
    decisionRequested: true,
    task: null,
    suspendedTask: null,
    lastTaskFailure: null,
    retryAfterTick: 0,
    workRole: 'none',
    carried: { kind: null, amount: 0 },
    lastMealAtTick: -1,
  };
  population.nextLifeId += 1;
  population.life.push(child);
  population.humans += 1;
  return child;
}
