import { AgentState, CarriedResourceKind, EntityKind } from '@/shared/gameTypes';

export type HumanFacing = 'north' | 'south' | 'east' | 'west';
export type HumanPose =
  | 'idle'
  | 'walk'
  | 'carry'
  | 'chop'
  | 'mine'
  | 'build'
  | 'eat'
  | 'sleep'
  | 'attack';
export type AnimalPose = 'idle' | 'walk' | 'eat' | 'attack';

const HUMAN_FRAME_COUNTS: Record<HumanPose, number> = {
  idle: 2,
  walk: 4,
  carry: 4,
  chop: 4,
  mine: 4,
  build: 4,
  eat: 2,
  sleep: 1,
  attack: 3,
};

const ANIMAL_FRAME_COUNTS: Record<AnimalPose, number> = {
  idle: 2,
  walk: 4,
  eat: 3,
  attack: 3,
};

export function humanFacing(heading: number): HumanFacing {
  const x = Math.cos(heading);
  const z = Math.sin(heading);
  if (Math.abs(x) > Math.abs(z)) return x >= 0 ? 'east' : 'west';
  return z >= 0 ? 'south' : 'north';
}

export function humanPose(state: AgentState, carried: CarriedResourceKind): HumanPose {
  if (state === AgentState.Rest) return 'sleep';
  if (state === AgentState.Eat || state === AgentState.FindFood) return 'eat';
  if (state === AgentState.GatherWood) return 'chop';
  if (state === AgentState.GatherStone) return 'mine';
  if (state === AgentState.Build || state === AgentState.Craft || state === AgentState.Butcher)
    return 'build';
  if (state === AgentState.Hunt) return 'attack';
  if (carried !== CarriedResourceKind.None) return 'carry';
  if (
    state === AgentState.Wander ||
    state === AgentState.Farm ||
    state === AgentState.Haul ||
    state === AgentState.Home ||
    state === AgentState.Flee ||
    state === AgentState.Chase ||
    state === AgentState.Fish
  )
    return 'walk';
  return 'idle';
}

export function animalPose(kind: EntityKind, state: AgentState): AnimalPose {
  if (kind === EntityKind.Fish || state === AgentState.Wander || state === AgentState.Flee) {
    return 'walk';
  }
  if (state === AgentState.Eat || state === AgentState.FindFood) return 'eat';
  if (state === AgentState.Attack || state === AgentState.Chase) return 'attack';
  return 'idle';
}

export function animationFrame(
  pose: HumanPose | AnimalPose,
  tick: number,
  entityId: number,
  animal = false,
): number {
  const counts = animal ? ANIMAL_FRAME_COUNTS : HUMAN_FRAME_COUNTS;
  const count = counts[pose as keyof typeof counts] ?? 1;
  return Math.floor((tick + entityId * 3) / 3) % count;
}
